
import { useState, useMemo, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import StepIndicator from "@/components/StepIndicator";
import DynamicFieldRenderer from "@/components/DynamicFieldRenderer";
import HashDisplay from "@/components/HashDisplay";
import StatusBadge from "@/components/StatusBadge";

import {
  createCanonicalData,
  generateSHA256,
  generateTokenId,
} from "@/lib/credential";

import { issueCredential } from "@/lib/api";

type CredentialType = "academic" | "license" | "government";

const STEPS = ["Enter Data", "Generate Hash", "Save Credential", "Generate QR"];

const SCHEMAS: Record<
  CredentialType,
  { name: string; label: string; type?: string }[]
> = {
  academic: [
    { name: "holderName", label: "Student Name" },
    { name: "regNumber", label: "Registration Number" },
    { name: "degreeId", label: "Degree ID" },
    { name: "degreeTitle", label: "Degree" },
    { name: "yearOfCompletion", label: "Year" },
    { name: "issuer", label: "Issuer / University" },
  ],

  license: [
    { name: "holderName", label: "Holder Name" },
    { name: "licenseNumber", label: "License Number" },
    { name: "licenseType", label: "License Type" },
    { name: "issueDate", label: "Issue Date", type: "date" },
    { name: "expiryDate", label: "Expiry Date", type: "date" },
    { name: "issuer", label: "Issuer" },
  ],

  government: [
    { name: "holderName", label: "Holder Name" },
    { name: "documentId", label: "Document ID" },
    { name: "dob", label: "Date of Birth", type: "date" },
    { name: "issueDate", label: "Issue Date", type: "date" },
    { name: "issuingAuthority", label: "Issuing Authority" },
  ],
};

const CANONICAL_ORDER: Record<CredentialType, string[]> = {
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

const DOCUMENT_LABELS: Record<CredentialType, string> = {
  academic: "Academic Degree",
  license: "Professional License",
  government: "Government Document",
};

export default function IssuePage() {
  const [docType, setDocType] = useState<CredentialType | "">("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const [hash, setHash] = useState<string | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [saving, setSaving] = useState(false);

  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const fields = useMemo(
    () => (docType ? SCHEMAS[docType] : []),
    [docType],
  );

  const allFilled = useMemo(
    () =>
      fields.length > 0 &&
      fields.every((field) => (values[field.name] || "").trim() !== ""),
    [fields, values],
  );

  // Build a verification URL using the current environment.
  // This works on localhost as well as GitHub Pages.
  const verificationUrl = useMemo(() => {
    if (!tokenId) return "";

    const basePath = import.meta.env.BASE_URL;

    const url = new URL(
      `${basePath}verify`,
      window.location.origin,
    );

    url.searchParams.set("tokenId", tokenId);

    return url.toString();
  }, [tokenId]);

  // Changing any field invalidates the previously generated hash.
  const handleChange = useCallback((name: string, value: string) => {
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));

    setHash(null);
    setCanonical(null);
    setAnchored(false);
    setQrVisible(false);
    setTokenId(null);
    setStep(0);
  }, []);

  const handleGenerateHash = async () => {
    if (!docType || !allFilled || hashing) return;

    setHashing(true);

    try {
      const order = CANONICAL_ORDER[docType];

      const canonicalData = createCanonicalData(
        order.map((fieldName) => values[fieldName]),
      );

      const generatedHash = await generateSHA256(canonicalData);

      setCanonical(canonicalData);
      setHash(generatedHash);
      setStep(1);
    } catch (error) {
      console.error("Hash generation failed:", error);

      window.alert(
        "Unable to generate the SHA-256 fingerprint. Please try again using HTTPS or localhost.",
      );
    } finally {
      setHashing(false);
    }
  };

  // Save the credential through the backend API.
  const handleAnchor = async () => {
    if (!docType || !hash || !canonical || anchored || saving) return;

    setSaving(true);

    try {
      const newTokenId = generateTokenId();
      const issuedAt = new Date().toISOString();

      const response = await issueCredential({
        tokenId: newTokenId,
        documentType: DOCUMENT_LABELS[docType],
        documentTypeKey: docType,
        data: { ...values },
        fingerprint: hash,
        issuedAt,
      });

      if (!response.success) {
        throw new Error("The backend could not save the credential.");
      }

      setTokenId(newTokenId);
      setAnchored(true);
      setStep(2);
    } catch (error) {
      console.error("Credential saving failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      window.alert(
        `Unable to save credential: ${message}\n\nPlease check that your backend server is running and try again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQR = () => {
    if (!anchored || !tokenId) return;

    setQrVisible(true);
    setStep(3);
  };

  const handleDocTypeChange = (value: string) => {
    if (
      value !== "academic" &&
      value !== "license" &&
      value !== "government"
    ) {
      return;
    }

    setDocType(value);
    setValues({});
    setHash(null);
    setAnchored(false);
    setQrVisible(false);
    setTokenId(null);
    setCanonical(null);
    setStep(0);
  };

  const getQRCodeSvg = () =>
    qrWrapperRef.current?.querySelector("svg");

  const handleDownloadQR = () => {
    const svg = getQRCodeSvg();

    if (!svg || !tokenId || !verificationUrl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const blob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const size = 1200;
      const canvas = document.createElement("canvas");

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          window.alert("Unable to download the QR code.");
          return;
        }

        const downloadUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");

        link.download = `DocuVerify-${tokenId}-QR.png`;
        link.href = downloadUrl;
        link.click();

        URL.revokeObjectURL(downloadUrl);
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      window.alert("Unable to generate the QR image. Please try again.");
    };

    img.src = url;
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Issue Document
      </h1>

      <p className="mb-8 text-sm text-muted-foreground">
        Enter document data, generate a SHA-256 fingerprint, save the
        credential to the database and create a QR code.
      </p>

      <StepIndicator steps={STEPS} currentStep={step} />

      <div className="mt-10 space-y-8">
        {/* Document type selection */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Document Type
          </label>

          <Select value={docType} onValueChange={handleDocTypeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="academic">Academic Degree</SelectItem>
              <SelectItem value="license">Professional License</SelectItem>
              <SelectItem value="government">Government Document</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic fields */}
        {docType && (
          <div className="animate-fade-in-up rounded-xl border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Document Fields
            </h2>

            <DynamicFieldRenderer
              fields={fields}
              values={values}
              onChange={handleChange}
            />
          </div>
        )}

        {/* Actions */}
        {docType && (
          <div className="animate-fade-in-up space-y-4 rounded-xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerateHash}
                disabled={!allFilled || !!hash || hashing}
              >
                {hashing ? "Generating..." : "Generate Fingerprint"}
              </Button>

              <Button
                onClick={handleAnchor}
                disabled={!hash || anchored || saving}
                variant="outline"
              >
                {saving ? "Saving..." : "Save Credential"}
              </Button>

              <Button
                onClick={handleGenerateQR}
                disabled={!anchored || qrVisible}
                variant="outline"
              >
                Generate QR
              </Button>
            </div>

            {hash && (
              <div className="space-y-3">
                <HashDisplay
                  label="Document Fingerprint (SHA-256)"
                  hash={hash}
                />
              </div>
            )}

            {anchored && tokenId && (
              <div className="animate-fade-in-up space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Credential Saved
                </h3>

                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Token ID:
                  </span>

                  <span className="text-xl font-bold text-primary">
                    {tokenId}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Document Fingerprint:
                  </span>

                  <span className="hash-text break-all text-xs text-foreground">
                    {hash}
                  </span>
                </div>

                <StatusBadge
                  status="anchored"
                  label="Saved to Database"
                />

                <p className="text-xs text-muted-foreground">
                  This credential has been saved in the MongoDB database
                  through the DocuVerify backend. Blockchain integration
                  has not yet been implemented.
                </p>
              </div>
            )}

            {qrVisible && tokenId && verificationUrl && (
              <div className="animate-fade-in-up mt-4 flex max-w-xs flex-col items-center rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 text-center text-sm font-semibold text-foreground">
                  Generated Verification QR Code
                </h3>

                <div
                  ref={qrWrapperRef}
                  className="rounded-lg bg-white p-2"
                >
                  <QRCodeSVG
                    value={verificationUrl}
                    size={240}
                    level="H"
                    includeMargin
                  />
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Token ID:{" "}
                  <span className="font-semibold text-primary">
                    {tokenId}
                  </span>
                </p>

                <p className="mt-2 break-all text-center text-xs text-muted-foreground">
                  {verificationUrl}
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={handleDownloadQR}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download QR Code
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Verification
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
