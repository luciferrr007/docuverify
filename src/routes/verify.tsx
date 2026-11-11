
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { Html5Qrcode } from "html5-qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  verifyCredential,
  type VerifyCredentialResponse,
} from "@/lib/api";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  ImageUp,
} from "lucide-react";

type Credential = VerifyCredentialResponse["credential"] & {
  blockNumber?: number | null;
};

type Verification = VerifyCredentialResponse["verification"] & {
  blockchainAvailable?: boolean;
  blockchainRecordExists?: boolean;
  blockchainFingerprintMatches?: boolean;
  blockchainIssuerMatches?: boolean;
  blockchainConfirmed?: boolean;
  contractAddressMatches?: boolean;
  blockchainVerified?: boolean;
  blockchainStatus?: string;
};

type Blockchain = {
  network?: string;
  contractAddress?: string;
  issuer?: string;
  registeredAt?: string;
};

type ApiResponse = Omit<
  VerifyCredentialResponse,
  "verification"
> & {
  verification: Verification;
  blockchain?: Blockchain;
};

type Result =
  | { kind: "idle" }
  | {
      kind: "found";
      credential: Credential;
      verification: Verification;
      blockchain: Blockchain | null;
      verified: boolean;
    }
  | {
      kind: "not-found";
      tokenId: string;
    }
  | {
      kind: "error";
      message: string;
    };

const SCANNER_ID = "docuverify-qr-reader";

const TOKEN_PATTERN = /^DCR-\d{4}-[0-9A-F]{8}$/i;

const LABELS: Record<string, string> = {
  holderName: "Holder Name",
  regNumber: "Registration Number",
  registrationNumber: "Registration Number",
  degreeId: "Degree ID",
  degreeTitle: "Degree",
  degree: "Degree",
  yearOfCompletion: "Year of Completion",
  issuer: "Issuer / University",
  licenseNumber: "License Number",
  licenseType: "License Type",
  issueDate: "Issue Date",
  expiryDate: "Expiry Date",
  documentId: "Document ID",
  dob: "Date of Birth",
  issuingAuthority: "Issuing Authority",
};

function extractToken(value: string): string | null {
  const text = value.trim();

  if (TOKEN_PATTERN.test(text)) {
    return text;
  }

  try {
    const url = new URL(text);
    const token = url.searchParams.get("tokenId");

    if (
      url.pathname.endsWith("/verify") &&
      token &&
      TOKEN_PATTERN.test(token)
    ) {
      return token;
    }
  } catch {
    return null;
  }

  return null;
}

function fieldLabel(key: string): string {
  if (LABELS[key]) {
    return LABELS[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string): string {
  if (!value) return "Not provided";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function verificationFailure(v: Verification): string {
  if (v.integrityValid === false) {
    return "Credential data integrity verification failed.";
  }

  if (v.blockchainAvailable !== true) {
    return "Blockchain verification is unavailable or incomplete.";
  }

  if (v.blockchainRecordExists !== true) {
    return "The credential was not found on the blockchain.";
  }

  if (v.blockchainFingerprintMatches !== true) {
    return "The credential fingerprint does not match the blockchain record.";
  }

  if (v.blockchainIssuerMatches !== true) {
    return "The issuer does not match the blockchain record.";
  }

  if (v.blockchainConfirmed !== true) {
    return "The blockchain transaction is not confirmed.";
  }

  if (v.contractAddressMatches !== true) {
    return "The smart contract address does not match.";
  }

  if (v.status !== "active") {
    return `Credential status is ${v.status}.`;
  }

  return "One or more required verification checks failed.";
}

function Detail({
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

      <p className="break-all text-sm text-foreground">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export default function VerifyPage() {
  const [tokenId, setTokenId] = useState("");

  const [result, setResult] = useState<Result>({
    kind: "idle",
  });

  const [loading, setLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const [qrMode, setQrMode] = useState<
    "choose" | "camera"
  >("choose");

  const [qrError, setQrError] = useState<string | null>(
    null,
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initialRef = useRef(false);
  const scanningRef = useRef(false);

  const runVerification = useCallback(async (id: string) => {
    setLoading(true);
    setResult({ kind: "idle" });

    try {
      const response = (await verifyCredential(
        id,
      )) as ApiResponse;

      if (!response.credential || !response.verification) {
        throw new Error(
          "Incomplete response received from the backend.",
        );
      }

      const v = response.verification;

      const verified =
        response.success === true &&
        v.isValid === true &&
        v.credentialExists === true &&
        v.integrityValid === true &&
        v.blockchainAvailable === true &&
        v.blockchainRecordExists === true &&
        v.blockchainFingerprintMatches === true &&
        v.blockchainIssuerMatches === true &&
        v.blockchainConfirmed === true &&
        v.contractAddressMatches === true &&
        v.blockchainVerified === true &&
        v.status === "active" &&
        response.credential.status === "active";

      setResult({
        kind: "found",
        credential: response.credential,
        verification: v,
        blockchain: response.blockchain ?? null,
        verified,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify credential.";

      if (message.toLowerCase().includes("not found")) {
        setResult({
          kind: "not-found",
          tokenId: id,
        });
      } else {
        setResult({
          kind: "error",
          message,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef.current) return;

    initialRef.current = true;

    const params = new URLSearchParams(
      window.location.search,
    );

    const value = params.get("tokenId");

    if (!value) return;

    const token = extractToken(value);

    if (!token) {
      setResult({
        kind: "error",
        message: "Invalid verification link.",
      });
      return;
    }

    setTokenId(token);
    void runVerification(token);
  }, [runVerification]);

  const handleVerify = () => {
    const token = extractToken(tokenId);

    if (!token) {
      setResult({
        kind: "error",
        message:
          "Please enter a valid Token ID in the format DCR-2026-XXXXXXXX.",
      });
      return;
    }

    setTokenId(token);
    void runVerification(token);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      handleVerify();
    }
  };

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    scannerRef.current = null;

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {
      // Scanner may not be running.
    }

    try {
      scanner.clear();
    } catch {
      // Ignore cleanup errors.
    }
  }, []);

  const closeQr = useCallback(async () => {
    setQrOpen(false);
    setQrMode("choose");
    setQrError(null);

    await stopScanner();
  }, [stopScanner]);

  const handleDecoded = useCallback(
    async (value: string) => {
      if (scanningRef.current) return;

      const token = extractToken(value);

      if (!token) {
        setQrError("Invalid credential QR code.");
        return;
      }

      scanningRef.current = true;

      await closeQr();

      setTokenId(token);
      void runVerification(token);

      scanningRef.current = false;
    },
    [closeQr, runVerification],
  );

  useEffect(() => {
    if (!qrOpen || qrMode !== "camera") return;

    let active = true;
    let localScanner: Html5Qrcode | null = null;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import(
          "html5-qrcode"
        );

        if (!active) return;

        const scanner = new Html5Qrcode(SCANNER_ID);
        localScanner = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          (text) => {
            if (active) {
              void handleDecoded(text);
            }
          },
          () => {},
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
      } catch {
        if (active) {
          setQrError(
            "Camera access failed. You can upload a QR image instead.",
          );
          setQrMode("choose");
        }
      }
    };

    void start();

    return () => {
      active = false;

      if (localScanner) {
        const scanner = localScanner as Html5Qrcode;

        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }

        void scanner
          .stop()
          .catch(() => {})
          .then(() => {
            try {
              scanner.clear();
            } catch {
              // Ignore cleanup errors.
            }
          });
      }
    };
  }, [qrOpen, qrMode, handleDecoded]);

  const handleImage = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setQrError(null);

    try {
      const { Html5Qrcode } = await import(
        "html5-qrcode"
      );

      const scanner = new Html5Qrcode(SCANNER_ID);

      try {
        const decoded = await scanner.scanFile(
          file,
          false,
        );

        await handleDecoded(decoded);
      } finally {
        try {
          scanner.clear();
        } catch {
          // Ignore cleanup errors.
        }
      }
    } catch {
      setQrError(
        "QR code could not be detected in the image.",
      );
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Verify Document
      </h1>

      <p className="mb-8 text-sm text-muted-foreground">
        Verify a credential by entering its Token ID or
        scanning the QR code issued with it.
      </p>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Token Retrieval
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="credential-token"
                className="text-sm font-medium text-foreground"
              >
                Token ID
              </label>

              <Input
                id="credential-token"
                placeholder="Enter Credential Token ID"
                value={tokenId}
                onChange={(event) => {
                  setTokenId(event.target.value);
                  setResult({ kind: "idle" });
                }}
                onKeyDown={handleKeyDown}
              />

              <p className="text-xs text-muted-foreground">
                Example: DCR-2026-XXXXXXXX
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleVerify}
                disabled={loading || !tokenId.trim()}
              >
                {loading
                  ? "Verifying..."
                  : "Verify Credential"}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setQrError(null);
                  setQrMode("choose");
                  setQrOpen(true);
                }}
              >
                Verify with QR
              </Button>
            </div>
          </div>
        </div>

        {result.kind === "found" && (
          <div className="animate-fade-in-up rounded-xl border bg-card p-6 shadow-card">
            <div
              className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
                result.verified
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              {result.verified ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="h-6 w-6 shrink-0 text-red-600" />
              )}

              <div>
                <p
                  className={`text-sm font-bold uppercase ${
                    result.verified
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {result.verified
                    ? "Credential Verified"
                    : "Credential Not Verified"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {result.verified
                    ? "Credential authenticity and integrity have been successfully verified."
                    : verificationFailure(
                        result.verification,
                      )}
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-4 text-sm font-semibold">
                Blockchain Information
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <Detail
                  label="Network"
                  value={
                    result.blockchain?.network ??
                    "Not available"
                  }
                />

                <Detail
                  label="Blockchain Status"
                  value={
                    result.verification.blockchainStatus ??
                    "Not available"
                  }
                />

                <Detail
                  label="Block Number"
                  value={
                    result.credential.blockNumber != null
                      ? String(result.credential.blockNumber)
                      : "Not available"
                  }
                />

                <Detail
                  label="Issuer Wallet"
                  value={
                    result.blockchain?.issuer ??
                    "Not available"
                  }
                />
              </div>
            </div>

            <div className="mb-5 rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document Type
              </p>

              <p className="text-sm font-semibold">
                {result.credential.documentType}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(
                result.credential.data,
              ).map(([key, value]) => (
                <Detail
                  key={key}
                  label={fieldLabel(key)}
                  value={String(value ?? "")}
                />
              ))}

              <Detail
                label="Token ID"
                value={result.credential.tokenId}
              />

              <Detail
                label="Issued Date"
                value={formatDate(
                  result.credential.issuedAt,
                )}
              />

              <Detail
                label="Credential Status"
                value={result.credential.status.toUpperCase()}
              />
            </div>
          </div>
        )}

        {result.kind === "not-found" && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive" />

              <div>
                <p className="text-sm font-semibold uppercase text-destructive">
                  Credential Not Found
                </p>

                <p className="text-xs text-muted-foreground">
                  No credential exists for Token ID{" "}
                  {result.tokenId}.
                </p>
              </div>
            </div>
          </div>
        )}

        {result.kind === "error" && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />

              <div>
                <p className="text-sm font-semibold uppercase text-destructive">
                  Verification Unavailable
                </p>

                <p className="text-xs text-muted-foreground">
                  {result.message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          if (!open) {
            void closeQr();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Verify using QR Code
            </DialogTitle>

            <DialogDescription>
              Scan a credential QR code or upload
              an image containing the code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {qrMode === "choose" ? (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 py-4"
                  onClick={() => {
                    setQrError(null);
                    setQrMode("camera");
                  }}
                >
                  <Camera className="h-5 w-5 text-primary" />
                  Scan with Camera
                </Button>

                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 py-4"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageUp className="h-5 w-5 text-primary" />
                  Upload QR Image
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  void stopScanner();
                  setQrMode("choose");
                }}
              >
                Back to Options
              </Button>
            )}

            <div
              id={SCANNER_ID}
              className={
                qrMode === "camera"
                  ? "overflow-hidden rounded-lg"
                  : "hidden"
              }
            />

            {qrError && (
              <p className="text-sm text-destructive">
                {qrError}
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/*"
              className="hidden"
              onChange={(event) => {
                void handleImage(event);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
