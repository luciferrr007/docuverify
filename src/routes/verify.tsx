import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCredentialByTokenId, type StoredCredential } from "@/lib/credentialRegistry";
import { createCanonicalData, generateSHA256 } from "@/lib/credential";
import { CheckCircle2, XCircle, Camera, ImageUp, AlertTriangle } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify Document — DocuVerify" },
      {
        name: "description",
        content:
          "Verify a DocuVerify credential by entering a Token ID or scanning a QR code.",
      },
      { property: "og:title", content: "Verify Document — DocuVerify" },
      {
        property: "og:description",
        content: "Verify a credential with a Token ID or QR code scan.",
      },
    ],
  }),
  component: VerifyPage,
});

type VerificationState =
  | { kind: "idle" }
  | { kind: "found"; credential: StoredCredential; integrity: "verified" | "failed" }
  | { kind: "not-found"; tokenId: string };

/**
 * Reconstruct the canonical data for an academic credential using the same
 * field order and rules used during issuance. The canonical string itself is
 * never displayed in the UI.
 */
function recreateCanonicalData(credential: StoredCredential): string {
  return createCanonicalData([
    credential.degreeId,
    credential.registrationNumber,
    credential.studentName,
    credential.degree,
    credential.year,
    credential.issuer,
  ]);
}

const SCANNER_CONTAINER_ID = "verify-qr-reader";
const TOKEN_ID_PATTERN = /^DCR-\d{4}-[0-9A-Fa-f]{8}$/;

function VerifyPage() {
  const [tokenId, setTokenId] = useState("");
  const [state, setState] = useState<VerificationState>({ kind: "idle" });
  const [qrOpen, setQrOpen] = useState(false);
  const [mode, setMode] = useState<"choose" | "camera">("choose");
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const verifyByTokenId = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      setState({ kind: "idle" });
      return;
    }

    const credential = getCredentialByTokenId(trimmed);
    if (!credential) {
      setState({ kind: "not-found", tokenId: trimmed });
      return;
    }

    const canonicalData = recreateCanonicalData(credential);
    const recomputedHash = await generateSHA256(canonicalData);
    const integrity = recomputedHash === credential.fingerprint ? "verified" : "failed";
    setState({ kind: "found", credential, integrity });
  };

  const handleVerify = () => {
    verifyByTokenId(tokenId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopped or not started.
      }
      try {
        scanner.clear();
      } catch {
        // Ignore cleanup errors.
      }
    }
  };

  const closeQrDialog = async () => {
    setQrOpen(false);
    setMode("choose");
    setScanError(null);
    await stopScanner();
  };

  // Shared handler for a decoded QR value (camera or uploaded image).
  const handleDecoded = async (decodedText: string) => {
    const value = decodedText.trim();
    if (!TOKEN_ID_PATTERN.test(value)) {
      setScanError("Invalid Credential QR Code");
      return;
    }
    await closeQrDialog();
    setTokenId(value);
    await verifyByTokenId(value);
  };

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
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (active) {
              handleDecoded(decodedText);
            }
          },
          () => {
            // Ignore per-frame decode errors while the camera is still framing.
          }
        );
        if (active) {
          scannerRef.current = scanner;
        }
      } catch (err) {
        if (active) {
          setScanError(
            err instanceof Error && err.message
              ? `Camera unavailable: ${err.message}. You can still verify by uploading a QR image.`
              : "Camera access is unavailable or was denied. You can still verify by uploading a QR image."
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
          // Ignore stop errors.
        }
        try {
          runningScanner.clear();
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, [qrOpen, mode]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Verify Document</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Verify a credential by entering its Token ID or scanning the QR code issued with it.
      </p>

      <div className="space-y-6">
        {/* Token ID input */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Token Retrieval</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Token ID</label>
              <Input
                placeholder="Enter Credential Token ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                onKeyDown={handleKeyDown}
                className="transition-colors focus:border-primary focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">Example: DCR-2026-XXXXXXXX</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleVerify} disabled={!tokenId.trim()}>
                Verify Credential
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
                    state.integrity === "verified" ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {state.integrity === "verified" ? "Credential Verified" : "Data Integrity Failed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.integrity === "verified"
                    ? "Credential is active and matches the stored record."
                    : "The credential data does not match the original fingerprint. Possible data modification detected."}
                </p>
              </div>
            </div>

            {state.integrity === "verified" && (
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Data Integrity Verified
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Student Name" value={state.credential.studentName} />
              <DetailItem label="Registration Number" value={state.credential.registrationNumber} />
              <DetailItem label="Degree ID" value={state.credential.degreeId} />
              <DetailItem label="Degree" value={state.credential.degree} />
              <DetailItem label="Year" value={state.credential.year} />
              <DetailItem label="Issuer / University" value={state.credential.issuer} />
              <DetailItem label="Token ID" value={state.credential.tokenId} />
              <DetailItem label="Issued Date" value={formatIssuedDate(state.credential.issuedAt)} />
            </div>
          </div>
        )}

        {state.kind === "not-found" && (
          <div className="animate-fade-in-up rounded-xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-destructive">
                  Credential Not Found
                </p>
                <p className="text-xs text-muted-foreground">
                  No credential exists for Token ID <span className="font-medium">{state.tokenId}</span>.
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
              Scan the credential QR code with your camera, or upload a QR image.
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
                    <span className="block text-sm font-semibold">Scan with Camera</span>
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
                    <span className="block text-sm font-semibold">Upload QR Image</span>
                    <span className="block text-xs text-muted-foreground">
                      Choose a PNG or JPG from gallery or files
                    </span>
                  </span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div id={SCANNER_CONTAINER_ID} className="overflow-hidden rounded-lg" />
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

            {scanError && <p className="text-xs text-destructive">{scanError}</p>}

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
  fullWidth = false,
  mono = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`break-words text-sm text-foreground ${mono ? "hash-text text-xs" : ""}`}
      >
        {value || <span className="italic text-muted-foreground">Not provided</span>}
      </p>
    </div>
  );
}
