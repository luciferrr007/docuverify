import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import StepIndicator from "@/components/StepIndicator";
import DynamicFieldRenderer from "@/components/DynamicFieldRenderer";
import HashDisplay from "@/components/HashDisplay";
import StatusBadge from "@/components/StatusBadge";
import QRPlaceholder from "@/components/QRPlaceholder";

const STEPS = ["Enter Data", "Generate Hash", "Anchor", "Generate QR"];

const SCHEMAS: Record<string, {name: string;label: string;type?: string;}[]> = {
  academic: [
  { name: "holderName", label: "Holder Name" },
  { name: "regNumber", label: "Registration Number" },
  { name: "degreeTitle", label: "Degree Title" },
  { name: "yearOfCompletion", label: "Year of Completion" },
  { name: "issuer", label: "Issuer" }],

  license: [
  { name: "holderName", label: "Holder Name" },
  { name: "licenseNumber", label: "License Number" },
  { name: "licenseType", label: "License Type" },
  { name: "issueDate", label: "Issue Date", type: "date" },
  { name: "expiryDate", label: "Expiry Date", type: "date" },
  { name: "issuer", label: "Issuer" }],

  government: [
  { name: "holderName", label: "Holder Name" },
  { name: "documentId", label: "Document ID" },
  { name: "dob", label: "Date of Birth", type: "date" },
  { name: "issueDate", label: "Issue Date", type: "date" },
  { name: "issuingAuthority", label: "Issuing Authority" }]

};

const randomHash = () =>
Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const generateTokenId = () =>
Math.floor(100000 + Math.random() * 900000);

const IssuePage = () => {
  const [docType, setDocType] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [tokenId, setTokenId] = useState<number | null>(null);

  const fields = docType ? SCHEMAS[docType] : [];

  const allFilled = useMemo(
    () => fields.length > 0 && fields.every((f) => (values[f.name] || "").trim() !== ""),
    [fields, values]
  );

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleGenerateHash = () => {
    setHash(randomHash());
    setStep(1);
  };

  const handleAnchor = () => {
    setAnchored(true);
    setTokenId(generateTokenId());
    setStep(2);
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
    setStep(0);
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
        {docType &&
        <div className="animate-fade-in-up rounded-xl border bg-card p-6 shadow-card">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Document Fields</h2>
            <DynamicFieldRenderer fields={fields} values={values} onChange={handleChange} />
          </div>
        }

        {/* Actions */}
        {docType &&
        <div className="animate-fade-in-up space-y-4 rounded-xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerateHash} disabled={!allFilled || !!hash}>
                Generate Fingerprint
              </Button>
               <Button onClick={handleAnchor} disabled={!hash || anchored} variant="outline">
                 Record on Blockchain
               </Button>
              <Button onClick={handleGenerateQR} disabled={!anchored || qrVisible} variant="outline">
                Generate QR
              </Button>
            </div>

            {hash &&
          <div className="space-y-3">
                <HashDisplay label="Document Fingerprint" hash={hash} />
              </div>
          }

            {anchored && tokenId &&
          <div className="animate-fade-in-up space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-foreground">Blockchain Record </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Token ID:</span>
                  <span className="text-xl font-bold text-primary">{tokenId}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Document Fingerprint:</span>
                  <span className="hash-text text-xs text-foreground">{hash}</span>
                </div>
                <StatusBadge status="anchored" label="Anchored" />
              </div>
          }

            {qrVisible &&
          <div className="mt-4 max-w-xs">
                <QRPlaceholder />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  QR encodes: Token ID <span className="font-semibold text-primary">{tokenId}</span>
                </p>
              </div>
          }
          </div>
        }
      </div>
    </div>);

};

export default IssuePage;