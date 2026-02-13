import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DynamicFieldRenderer from "@/components/DynamicFieldRenderer";
import HashDisplay from "@/components/HashDisplay";
import StatusBadge from "@/components/StatusBadge";
import { Upload } from "lucide-react";

const SCHEMAS: Record<string, { name: string; label: string; type?: string }[]> = {
  academic: [
    { name: "holderName", label: "Holder Name" },
    { name: "regNumber", label: "Registration Number" },
    { name: "degreeTitle", label: "Degree Title" },
    { name: "yearOfCompletion", label: "Year of Completion" },
    { name: "issuer", label: "Issuer" },
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

const DOC_LABELS: Record<string, string> = {
  academic: "Academic Degree",
  license: "Professional License",
  government: "Government Document",
};

const randomHash = () =>
  Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const VerifyPage = () => {
  const [tokenId, setTokenId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [docType, setDocType] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [recomputedHash, setRecomputedHash] = useState<string | null>(null);

  const fields = docType ? SCHEMAS[docType] : [];

  const allFilled = useMemo(
    () => fields.length > 0 && fields.every((f) => (values[f.name] || "").trim() !== ""),
    [fields, values]
  );

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleLoad = () => {
    // Simulate loading a random doc type
    const types = Object.keys(SCHEMAS);
    const picked = types[Math.floor(Math.random() * types.length)];
    setDocType(picked);
    setStoredHash(randomHash());
    setLoaded(true);
    setValues({});
    setRecomputedHash(null);
  };

  const handleRecompute = () => {
    setRecomputedHash(randomHash());
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Verify Document</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Enter a Token ID or scan a QR code, then re-enter document fields to verify integrity.
      </p>

      {/* Token retrieval */}
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Token Retrieval</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Token ID</label>
              <Input
                placeholder="Enter Token ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="transition-colors focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-4">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Drag & drop QR (placeholder)</p>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleLoad}
            disabled={!tokenId.trim()}
          >
            Load Document Type
          </Button>
        </div>

        {/* Dynamic form */}
        {loaded && (
          <div className="animate-fade-in-up rounded-xl border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <StatusBadge status="neutral" label={DOC_LABELS[docType] || docType} />
            </div>
            <DynamicFieldRenderer fields={fields} values={values} onChange={handleChange} />
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyPage;
