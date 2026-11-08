
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { verifyCredential, type VerifyCredentialResponse } from "@/lib/api";
import { createCanonicalData, generateSHA256 } from "@/lib/credential";

import {
  CheckCircle2,
  XCircle,
  Camera,
  ImageUp,
  AlertTriangle,
} from "lucide-react";

import type { Html5Qrcode } from "html5-qrcode";

type VerifiedCredential = VerifyCredentialResponse["credential"];

type VerificationState =
  | { kind: "idle" }
  | {
      kind: "found";
      credential: VerifiedCredential;
      integrity: "verified" | "failed";
    }
  | { kind: "not-found"; tokenId: string };

const SCANNER_CONTAINER_ID = "verify-qr-reader";

const TOKEN_ID_PATTERN = /^DCR-\d{4}-[0-9A-Fa-f]{8}$/;

const FIELD_LABELS: Record<string, string> = {
  holderName: "Holder Name",
  regNumber: "Registration Number",
  registrationNumber: "Registration Number",
  degreeId: "Degree ID",
  degreeTitle: "Degree",
  degree: "Degree",
  yearOfCompletion: "Year of Completion",
  year: "Year",
  issuer: "Issuer / University",
  licenseNumber: "License Number",
  licenseType: "License Type",
  issueDate: "Issue Date",
  expiryDate: "Expiry Date",
  documentId: "Document ID",
  dob: "Date of Birth",
  issuingAuthority: "Issuing Authority",
};

/**
 * Extract a Token ID from either:
 * 1. A raw Token ID.
 * 2. A complete DocuVerify verification URL.
 */
function extractTokenId(value: string): string | null {
  const trimmed = value.trim();

  // Support existing QR codes containing only a Token ID.
  if (TOKEN_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Support QR codes containing a verification URL.
  try {
    const url = new URL(trimmed);

    const tokenId = url.searchParams.get("tokenId");

    if (
      url.pathname.endsWith("/verify") &&
      tokenId &&
      TOKEN_ID_PATTERN.test(tokenId)
    ) {
      return tokenId;
    }
  } catch {
    return null;
  }

  return null;
}

function recreateCanonicalData(credential: VerifiedCredential): string {
  const canonicalOrder: Record<string, string[]> = {
    academic: [
      "degreeId",
      "regNumber",
      "holderName",
      "degreeTitle",
      "yearOfCompletion",
      "issuer",
    ],
    license: [
      "licenseNumber",
      "licenseType",
      "holderName",
      "issueDate",
      "expiryDate",
      "issuer",
    ],
    government: [
      "documentId",
      "holderName",
      "dob",
      "issueDate",
      "issuingAuthority",
    ],
  };

  const order = canonicalOrder[credential.documentTypeKey];

  if (!order) {
    throw new Error(
      `Unsupported credential type: ${credential.documentTypeKey}`,
    );
  }

  return createCanonicalData(
    order.map((fieldName) => String(credential.data[fieldName] ?? "")),
  );
}

function formatFieldLabel(fieldName: string): string {
  if (FIELD_LABELS[fieldName]) {
    return FIELD_LABELS[fieldName];
  }

  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function getCredentialFields(
  credential: VerifiedCredential,
): { label: string; value: string }[] {
  return Object.entries(credential.data).map(([fieldName, value]) => ({
    label: formatFieldLabel(fieldName),
    value: String(value ?? ""),
  }));
}

export default function VerifyPage() {
  const [tokenId, setTokenId] = useState("");

  const [state, setState] = useState<VerificationState>({
    kind: "idle",
  });

  const [qrOpen, setQrOpen] = useState(false);

  const [mode, setMode] = useState<"choose" | "camera">("choose");

  const [scanError, setScanError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const autoVerifiedRef = useRef(false);

  /**
   * Verify a credential using its Token ID.
   * Credential data is retrieved from MongoDB through the backend API.
   */
  const verifyByTokenId = useCallback(async (id: string) => {
    const trimmed = id.trim();

    if (!trimmed) {
      setState({ kind: "idle" });
      return;
    }

    setVerifying(true);
    setState({ kind: "idle" });

    try {
      const response = await verifyCredential(trimmed);

      const credential = response.credential;

      const canonicalData = recreateCanonicalData(credential);

      const recomputedHash = await generateSHA256(canonicalData);

      console.log("Credential verification details:", {
        tokenId: credential.tokenId,
        documentType: credential.documentType,
        documentTypeKey: credential.documentTypeKey,
        canonicalData,
        storedFingerprint: credential.fingerprint,
        recomputedFingerprint: recomputedHash,
        backendIntegrityValid: response.verification.integrityValid,
        backendCredentialValid: response.verification.isValid,
      });

      const integrity =
        response.verification.integrityValid &&
        recomputedHash.toLowerCase() === credential.fingerprint.toLowerCase()
          ? "verified"
          : "failed";

      setState({
        kind: "found",
        credential,
        integrity,
      });
    } catch (error) {
      console.error("Credential verification failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify credential.";

      if (message.toLowerCase().includes("not found")) {
        setState({
          kind: "not-found",
          tokenId: trimmed,
        });
      } else {
        window.alert(`Unable to verify this credential: ${message}`);
      }
    } finally {
      setVerifying(false);
    }
  }, []);

  /**
   * Automatically verify when the page is opened with:
   *
   * /verify?tokenId=DCR-2026-XXXXXXXX
   */
  useEffect(() => {
    if (autoVerifiedRef.current) return;

    const params = new URLSearchParams(window.location.search);

    const urlTokenId = params.get("tokenId");

    if (!urlTokenId) return;

    const extractedTokenId = extractTokenId(urlTokenId);

    if (!extractedTokenId) {
      setScanError("Invalid credential verification link.");
      return;
    }

    autoVerifiedRef.current = true;

    setTokenId(extractedTokenId);

    verifyByTokenId(extractedTokenId);
  }, [verifyByTokenId]);

  const handleVerify = () => {
    const extractedTokenId = extractTokenId(tokenId);

    if (!extractedTokenId) {
      setState({
        kind: "not-found",
        tokenId: tokenId.trim(),
      });
      return;
    }

    setTokenId(extractedTokenId);
    verifyByTokenId(extractedTokenId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  /**
   * Stop the QR scanner safely.
   */
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    scannerRef.current = null;

    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopped.
      }

      try {
        scanner.clear();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }, []);

  const closeQrDialog = useCallback(async () => {
    setQrOpen(false);
    setMode("choose");
    setScanError(null);

    await stopScanner();
  }, [stopScanner]);

  /**
   * Handle decoded QR content.
   *
   * Supports both raw Token IDs and complete verification URLs.
   */
  const handleDecoded = useCallback(
    async (decodedText: string) => {
      const extractedTokenId = extractTokenId(decodedText);

      if (!extractedTokenId) {
        setScanError("Invalid Credential QR Code");
        return;
      }

      await closeQrDialog();

      setTokenId(extractedTokenId);

      await verifyByTokenId(extractedTokenId);
    },
    [closeQrDialog, verifyByTokenId],
  );

  /**
   * Start camera QR scanner.
   */
  useEffect(() => {
    if (!qrOpen || mode !== "camera") return;

    let active = true;

    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!active) return;

        scanner = new Html5Qrcode(SCANNER_CONTAINER_ID);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          (decodedText) => {
            if (active) {
              handleDecoded(decodedText);
            }
          },
          () => {
            // Ignore frame-by-frame scanning errors.
          },
        );

        if (active) {
          scannerRef.current = scanner;
        } else {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            // Ignore cleanup errors.
          }
        }
      } catch (err) {
        if (active) {
          setScanError(
            err instanceof Error && err.message
              ? `Camera unavailable: ${err.message}. You can still verify by uploading a QR image.`
              : "Camera access is unavailable or was denied. You can still upload a QR image.",
          );

          setMode("choose");
        }
      }
    };

    startScanner();

    return () => {
      active = false;

      const runningScanner = scannerRef.current;

      scannerRef.current = null;

      if (runningScanner) {
        try {
          runningScanner.stop().catch(() => {});
        } catch {
          // Ignore cleanup errors.
        }

        try {
          runningScanner.clear();
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, [qrOpen, mode, handleDecoded]);

  /**
   * Verify using an uploaded QR image.
   */
  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    setScanError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      const fileScanner = new Html5Qrcode(SCANNER_CONTAINER_ID);

      try {
        const decoded = await fileScanner.scanFile(file, false);

        await handleDecoded(decoded);
      } finally {
        try {
          fileScanner.clear();
        } catch {
          // Ignore cleanup errors.
        }
      }
    } catch {
      setScanError("QR Code Not Detected");
    }
  };

  const formatIssuedDate = (iso: string) => {
    if (!iso) return "Not provided";

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Verify Document
      </h1>

      <p className="mb-8 text-sm text-muted-foreground">
        Verify a credential by entering its Token ID or scanning the QR code
        issued with it.
      </p>

      <div className="space-y-6">
        {/* Token ID input */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Token Retrieval
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Token ID
              </label>

              <Input
                placeholder="Enter Credential Token ID"
                value={tokenId}
                onChange={(e) => {
                  setTokenId(e.target.value);
                  setState({ kind: "idle" });
                  setScanError(null);
                }}
                onKeyDown={handleKeyDown}
                className="transition-colors focus:border-primary focus:ring-primary"
              />

              <p className="text-xs text-muted-foreground">
                Example: DCR-2026-XXXXXXXX
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleVerify}
                disabled={!tokenId.trim() || verifying}
              >
                {verifying ? "Verifying..." : "Verify Credential"}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setScanError(null);
                  setMode("choose");
                  setQrOpen(true);
                }}
              >
                Verify with QR
              </Button>
            </div>

            {scanError && !qrOpen && (
              <p className="text-xs text-destructive">{scanError}</p>
            )}
          </div>
        </div>

        {/* Verification result */}
        {state.kind === "found" && (
          <div className="animate-fade-in-up rounded-xl border bg-card p-6 shadow-card">
            <div className="mb-6 flex items-center gap-3">
              {state.integrity === "verified" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              )}

              <div>
                <p
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    state.integrity === "verified"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {state.integrity === "verified"
                    ? "Credential Verified"
                    : "Data Integrity Failed"}
                </p>

                <p className="text-xs text-muted-foreground">
                  {state.integrity === "verified"
                    ? "The credential data matches its stored fingerprint."
                    : "The credential data does not match the original fingerprint. Possible data modification detected."}
                </p>
              </div>
            </div>

            {/* Integrity result */}
            {state.integrity === "verified" && (
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Data Integrity Verified
                </p>
              </div>
            )}

            {/* Credential information */}
            <div className="mb-5 rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document Type
              </p>

              <p className="text-sm font-semibold text-foreground">
                {state.credential.documentType}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {getCredentialFields(state.credential).map((field) => (
                <DetailItem
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}

              <DetailItem
                label="Token ID"
                value={state.credential.tokenId}
              />

              <DetailItem
                label="Issued Date"
                value={formatIssuedDate(state.credential.issuedAt)}
              />

              <DetailItem
                label="Credential Status"
                value={state.credential.status.toUpperCase()}
              />
            </div>

            <div className="mt-6 rounded-lg border bg-muted/30 p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                This verification checks the SHA-256 fingerprint against the
                credential stored in MongoDB. Blockchain verification has not
                yet been integrated.
              </p>
            </div>
          </div>
        )}

        {/* Credential not found */}
        {state.kind === "not-found" && (
          <div className="animate-fade-in-up rounded-xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive" />

              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-destructive">
                  Credential Not Found
                </p>

                <p className="text-xs text-muted-foreground">
                  No credential exists for Token ID{" "}
                  <span className="font-medium">{state.tokenId}</span>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR verification dialog */}
      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeQrDialog();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify using QR Code</DialogTitle>

            <DialogDescription>
              Scan the credential QR code with your camera, or upload a QR
              image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mode === "choose" ? (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 py-4"
                  onClick={() => {
                    setScanError(null);
                    setMode("camera");
                  }}
                >
                  <Camera className="h-5 w-5 text-primary" />

                  <span className="text-left">
                    <span className="block text-sm font-semibold">
                      Scan with Camera
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      Uses any available camera on this device
                    </span>
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 py-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageUp className="h-5 w-5 text-primary" />

                  <span className="text-left">
                    <span className="block text-sm font-semibold">
                      Upload QR Image
                    </span>

                    <span className="block text-xs text-muted-foreground">
                      Choose a PNG or JPG from gallery or files
                    </span>
                  </span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  id={SCANNER_CONTAINER_ID}
                  className="overflow-hidden rounded-lg"
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await stopScanner();
                    setMode("choose");
                  }}
                >
                  Back to options
                </Button>
              </div>
            )}

            {mode === "choose" && (
              <div id={SCANNER_CONTAINER_ID} className="hidden" />
            )}

            {scanError && (
              <p className="text-xs text-destructive">{scanError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="break-words text-sm text-foreground">
        {value || (
          <span className="italic text-muted-foreground">
            Not provided
          </span>
        )}
      </p>
    </div>
  );
}
