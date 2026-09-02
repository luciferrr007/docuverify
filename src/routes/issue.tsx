import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
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
import { createCanonicalData, generateSHA256, generateTokenId } from "@/lib/credential";
import { saveCredential, type StoredCredential } from "@/lib/credentialRegistry";

export const Route = createFileRoute("/issue")({
  head: () => ({
    meta: [
      { title: "Issue Document — DocuVerify" },
      {
        name: "description",
        content:
          "Simulate the DocuVerify issuance flow: enter document data, generate a fingerprint, anchor it and create a QR code.",
      },
      { property: "og:title", content: "Issue Document — DocuVerify" },
      {
        property: "og:description",
        content: "Enter document data, generate a fingerprint, anchor it and create a QR code.",
      },
    ],
  }),
  component: IssuePage,
});

const STEPS = ["Enter Data", "Generate Hash", "Anchor", "Generate QR"];

const SCHEMAS: Record<string, { name: string; label: string; type?: string }[]> = {
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

const CANONICAL_ORDER: Record<string, string[]> = {
  academic: ["degreeId", "regNumber", "holderName", "degreeTitle", "yearOfCompletion", "issuer"],
  license: ["licenseNumber", "licenseType", "holderName", "issueDate", "expiryDate", "issuer"],
  government: ["documentId", "holderName", "dob", "issueDate", "issuingAuthority"],
};

function IssuePage() {
  const [docType, setDocType] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const fields = (docType ? SCHEMAS[docType] : []) ?? [];

  const allFilled = useMemo(
    () => fields.length > 0 && fields.every((f) => (values[f.name] || "").trim() !== ""),
    [fields, values],
  );

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleGenerateHash = async () => {
    setHashing(true);
    try {
      const order = CANONICAL_ORDER[docType] ?? fields.map((f) => f.name);
      const canonicalData = createCanonicalData(order.map((name) => values[name]));
      setCanonical(canonicalData);
      setHash(await generateSHA256(canonicalData));
      setStep(1);
    } finally {
      setHashing(false);
    }
  };

  const handleAnchor = () => {
    const newTokenId = generateTokenId();
    setAnchored(true);
    setTokenId(newTokenId);
    setStep(2);

    if (hash) {
      const credential: StoredCredential = {
        tokenId: newTokenId,
        documentType:
          docType === "academic"
            ? "Academic Degree"
            : docType === "license"
              ? "Professional License"
              : "Government Document",
        studentName: values["holderName"]?.trim() ?? "",
        registrationNumber: values["regNumber"]?.trim() ?? "",
        degreeId: values["degreeId"]?.trim() ?? "",
        degree: values["degreeTitle"]?.trim() ?? "",
        year: values["yearOfCompletion"]?.trim() ?? "",
        issuer: values["issuer"]?.trim() ?? "",
        fingerprint: hash,
        issuedAt: new Date().toISOString(),
        status: "active",
      };
      saveCredential(credential);
    }
  };

  const handleGenerateQR = () => {
    setQrVisible(true);
    setStep(3);
  };

  const handleDocTypeChange = (val: string) => {
    setDocType(val);
    setValues({});
    setHash(null);
    setAnchored(false);
    setQrVisible(false);
    setTokenId(null);
    setCanonical(null);
    setStep(0);
  };

  const getQRCodeSvg = () => qrWrapperRef.current?.querySelector("svg");

  const handleDownloadQR = () => {
    const svg = getQRCodeSvg();
    if (!svg || !tokenId) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const size = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const link = document.createElement("a");
        link.download = `DocuVerify-${tokenId}-QR.png`;
        link.href = URL.createObjectURL(pngBlob);
        link.click();
        URL.revokeObjectURL(link.href);
      }, "image/png");
    };
    img.src = url;
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Issue Document</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Simulate the issuance flow: enter data, generate a hash, anchor, and create a QR code.
      </p>

      <StepIndicator steps={STEPS} currentStep={step} />

      <div className="mt-10 space-y-8">
        {/* Document type */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <label className="mb-2 block text-sm font-semibold text-foreground">Document Type</label>
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
            <h2 className="mb-4 text-sm font-semibold text-foreground">Document Fields</h2>
            <DynamicFieldRenderer fields={fields} values={values} onChange={handleChange} />
          </div>
        )}

        {/* Actions */}
        {docType && (
          <div className="animate-fade-in-up space-y-4 rounded-xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerateHash} disabled={!allFilled || !!hash || hashing}>
                {hashing ? "Generating…" : "Generate Fingerprint"}
              </Button>
              <Button onClick={handleAnchor} disabled={!hash || anchored} variant="outline">
                Record on Blockchain
              </Button>
              <Button onClick={handleGenerateQR} disabled={!anchored || qrVisible} variant="outline">
                Generate QR
              </Button>
            </div>

            {hash && (
              <div className="space-y-3">
                <HashDisplay label="Document Fingerprint (SHA-256)" hash={hash} />
              </div>
            )}

            {anchored && tokenId && (
              <div className="animate-fade-in-up space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-foreground">Blockchain Record </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Token ID:</span>
                  <span className="text-xl font-bold text-primary">{tokenId}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Document Fingerprint:
                  </span>
                  <span className="hash-text text-xs text-foreground">{hash}</span>
                </div>
                <StatusBadge status="anchored" label="Anchored" />
              </div>
            )}

            {qrVisible && tokenId && (
              <div className="animate-fade-in-up mt-4 flex max-w-xs flex-col items-center rounded-xl border bg-card p-6 shadow-card">
                <h3 className="mb-4 text-center text-sm font-semibold text-foreground">
                  Generated Verification QR Code
                </h3>
                <div ref={qrWrapperRef} className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={tokenId} size={200} level="M" includeMargin />
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Token ID: <span className="font-semibold text-primary">{tokenId}</span>
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button onClick={handleDownloadQR} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download QR Code
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
