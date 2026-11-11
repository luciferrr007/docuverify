
import { useState, useMemo, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";

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

type CredentialType = "academic" | "license" | "government";

interface FieldDefinition {
  name: string;
  label: string;
  type?: string;
  readOnly?: boolean;
}

interface IssuanceResponse {
  success: boolean;
  message?: string;
  duplicate?: boolean;
  tokenId?: string;
  blockchainStatus?: string;
  transactionHash?: string | null;
  existingCredential?: {
    tokenId: string;
    blockchainStatus: string;
    status: string;
    transactionHash?: string | null;
    blockNumber?: number | null;
  };
  credential?: {
    tokenId: string;
    blockchainStatus?: string;
    transactionHash?: string;
    blockNumber?: number;
  };
  blockchain?: {
    status?: string;
    transactionHash?: string;
    blockNumber?: number;
    network?: string;
  };
}

type IssueNotice =
  | {
      kind: "duplicate";
      message: string;
      tokenId: string | null;
      blockchainStatus: string | null;
    }
  | {
      kind: "pending";
      message: string;
      tokenId: string | null;
      transactionHash: string | null;
    }
  | {
      kind: "error";
      message: string;
    }
  | null;

const STEPS = [
  "Enter Data",
  "Generate Hash",
  "Save Credential",
  "Generate QR",
];

const SCHEMAS: Record<CredentialType, FieldDefinition[]> = {
  academic: [
    { name: "holderName", label: "Student Name" },
    { name: "regNumber", label: "Registration Number" },
    { name: "degreeId", label: "Degree ID" },
    { name: "degreeTitle", label: "Degree" },
    { name: "yearOfCompletion", label: "Year" },
    {
      name: "issuer",
      label: "Issuer / University",
      readOnly: true,
    },
  ],
  license: [
    { name: "holderName", label: "Holder Name" },
    { name: "licenseNumber", label: "License Number" },
    { name: "licenseType", label: "License Type" },
    { name: "issueDate", label: "Issue Date", type: "date" },
    { name: "expiryDate", label: "Expiry Date", type: "date" },
    {
      name: "issuer",
      label: "Issuer",
      readOnly: true,
    },
  ],
  government: [
    { name: "holderName", label: "Holder Name" },
    { name: "documentId", label: "Document ID" },
    { name: "dob", label: "Date of Birth", type: "date" },
    { name: "issueDate", label: "Issue Date", type: "date" },
    {
      name: "issuingAuthority",
      label: "Issuing Authority",
    },
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

function getRegisteredInstitutionName(): string {
  try {
    const stored = sessionStorage.getItem("institution");

    if (!stored) return "";

    const institution = JSON.parse(stored) as {
      institutionName?: unknown;
    };

    return typeof institution.institutionName === "string"
      ? institution.institutionName.trim()
      : "";
  } catch {
    return "";
  }
}

async function submitCredential(
  payload: {
    tokenId: string;
    documentType: string;
    documentTypeKey: CredentialType;
    data: Record<string, string>;
    fingerprint: string;
    issuedAt: string;
  },
): Promise<{
  response: IssuanceResponse;
  httpStatus: number;
}> {
  const token = sessionStorage.getItem("institutionToken");

  if (!token) {
    throw new Error(
      "Please log in with an approved institution account.",
    );
  }

  const apiBase = import.meta.env["VITE_API_BASE_URL"];

  if (!apiBase || typeof apiBase !== "string") {
    throw new Error(
      "Backend API URL is not configured.",
    );
  }

  const httpResponse = await fetch(
    `${apiBase.replace(/\/$/, "")}/credentials/issue`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  let result: IssuanceResponse;

  try {
    result = (await httpResponse.json()) as IssuanceResponse;
  } catch {
    throw new Error(
      "The backend returned an invalid response.",
    );
  }

  return {
    response: result,
    httpStatus: httpResponse.status,
  };
}

export default function IssuePage() {
  const [institutionName] = useState(
    getRegisteredInstitutionName,
  );

  const [docType, setDocType] = useState<
    CredentialType | ""
  >("");

  const [values, setValues] = useState<
    Record<string, string>
  >({
    issuer: getRegisteredInstitutionName(),
  });

  const [step, setStep] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<string | null>(
    null,
  );

  const [hashing, setHashing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<IssueNotice>(null);

  const [confirmedBlock, setConfirmedBlock] = useState<
    number | null
  >(null);

  const [confirmedTransaction, setConfirmedTransaction] =
    useState<string | null>(null);

  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const fields = useMemo(
    () => (docType ? SCHEMAS[docType] : []),
    [docType],
  );

  const allFilled = useMemo(
    () =>
      fields.length > 0 &&
      fields.every(
        (field) =>
          (values[field.name] || "").trim() !== "",
      ),
    [fields, values],
  );

  const verificationUrl = useMemo(() => {
    if (!tokenId) return "";

    const url = new URL(
      `${import.meta.env.BASE_URL}verify`,
      window.location.origin,
    );

    url.searchParams.set("tokenId", tokenId);

    return url.toString();
  }, [tokenId]);

  const clearIssuance = useCallback(() => {
    setHash(null);
    setCanonical(null);
    setAnchored(false);
    setQrVisible(false);
    setTokenId(null);
    setNotice(null);
    setConfirmedBlock(null);
    setConfirmedTransaction(null);
    setStep(0);
  }, []);

  const handleChange = useCallback(
    (name: string, value: string) => {
      setValues((previous) => ({
        ...previous,
        [name]: value,
      }));

      clearIssuance();
    },
    [clearIssuance],
  );

  const handleGenerateHash = async () => {
    if (!docType || !allFilled || hashing) return;

    setHashing(true);
    setNotice(null);

    try {
      const order = CANONICAL_ORDER[docType];

      const canonicalData = createCanonicalData(
        order.map((fieldName) => values[fieldName]),
      );

      const generatedHash =
        await generateSHA256(canonicalData);

      setCanonical(canonicalData);
      setHash(generatedHash);
      setStep(1);
    } catch (error) {
      console.error("Hash generation failed:", error);

      setNotice({
        kind: "error",
        message:
          "Unable to generate the SHA-256 fingerprint.",
      });
    } finally {
      setHashing(false);
    }
  };

  const handleAnchor = async () => {
    if (!docType || !hash || !canonical || anchored || saving) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const newTokenId = generateTokenId();
      const issuedAt = new Date().toISOString();

      const { response, httpStatus } =
        await submitCredential({
          tokenId: newTokenId,
          documentType: DOCUMENT_LABELS[docType],
          documentTypeKey: docType,
          data: { ...values },
          fingerprint: hash,
          issuedAt,
        });

      if (
        httpStatus === 409 &&
        response.duplicate === true
      ) {
        setNotice({
          kind: "duplicate",
          message:
            response.message ||
            "This credential already exists.",
          tokenId:
            response.existingCredential?.tokenId ??
            null,
          blockchainStatus:
            response.existingCredential?.blockchainStatus ??
            null,
        });

        return;
      }

      if (
        httpStatus === 202 ||
        response.blockchainStatus === "pending"
      ) {
        setNotice({
          kind: "pending",
          message:
            response.message ||
            "Blockchain confirmation is pending.",
          tokenId: response.tokenId ?? newTokenId,
          transactionHash:
            response.transactionHash ?? null,
        });

        return;
      }

      if (
        !(
          httpStatus === 201 &&
          response.success === true &&
          response.blockchain?.status === "confirmed" &&
          response.credential?.blockchainStatus ===
            "confirmed"
        )
      ) {
        setNotice({
          kind: "error",
          message:
            response.message ||
            "Credential issuance was not completed.",
        });

        return;
      }

      const savedToken =
        response.credential.tokenId;

      if (!savedToken) {
        setNotice({
          kind: "error",
          message:
            "The backend did not return a Token ID.",
        });

        return;
      }

      setTokenId(savedToken);
      setAnchored(true);
      setStep(2);

      setConfirmedBlock(
        response.blockchain.blockNumber ?? null,
      );

      setConfirmedTransaction(
        response.blockchain.transactionHash ?? null,
      );
    } catch (error) {
      console.error("Credential saving failed:", error);

      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
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

    setValues(
      value === "academic" || value === "license"
        ? { issuer: institutionName }
        : {},
    );

    clearIssuance();
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
      window.alert(
        "Unable to generate the QR image. Please try again.",
      );
    };

    img.src = url;
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Issue Document
      </h1>

      <p className="mb-8 text-sm text-muted-foreground">
        Enter document data, generate a SHA-256 fingerprint,
        register the credential on Polygon Amoy and create
        a verification QR code.
      </p>

      <StepIndicator steps={STEPS} currentStep={step} />

      <div className="mt-10 space-y-8">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Document Type
          </label>

          <Select
            value={docType}
            onValueChange={handleDocTypeChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="academic">
                Academic Degree
              </SelectItem>

              <SelectItem value="license">
                Professional License
              </SelectItem>

              <SelectItem value="government">
                Government Document
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        {docType && (
          <div className="animate-fade-in-up space-y-4 rounded-xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerateHash}
                disabled={
                  !allFilled ||
                  !!hash ||
                  hashing ||
                  saving ||
                  anchored
                }
              >
                {hashing
                  ? "Generating..."
                  : "Generate Fingerprint"}
              </Button>

              <Button
                onClick={handleAnchor}
                disabled={
                  !hash ||
                  anchored ||
                  saving ||
                  notice?.kind === "pending"
                }
                variant="outline"
              >
                {saving
                  ? "Saving..."
                  : "Save Credential"}
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
              <HashDisplay
                label="Document Fingerprint (SHA-256)"
                hash={hash}
              />
            )}

            {notice?.kind === "duplicate" && (
              <div
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                  <div className="space-y-2">
                    <h3 className="font-semibold text-amber-900">
                      Credential Already Issued
                    </h3>

                    <p className="text-sm text-amber-900">
                      {notice.message}
                    </p>

                    {notice.tokenId && (
                      <p className="text-sm text-amber-900">
                        Existing Token ID:{" "}
                        <strong>{notice.tokenId}</strong>
                      </p>
                    )}

                    {notice.blockchainStatus && (
                      <p className="text-sm text-amber-900">
                        Blockchain Status:{" "}
                        <strong>
                          {notice.blockchainStatus}
                        </strong>
                      </p>
                    )}

                    <p className="text-xs text-amber-800">
                      No new credential was created by this
                      request. Use the existing credential
                      or review its status in the institution
                      dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {notice?.kind === "pending" && (
              <div
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-5"
              >
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                  <div className="space-y-2">
                    <h3 className="font-semibold text-amber-900">
                      Blockchain Confirmation Pending
                    </h3>

                    <p className="text-sm text-amber-900">
                      {notice.message}
                    </p>

                    {notice.tokenId && (
                      <p className="text-sm text-amber-900">
                        Token ID:{" "}
                        <strong>{notice.tokenId}</strong>
                      </p>
                    )}

                    {notice.transactionHash && (
                      <p className="break-all text-xs text-amber-900">
                        Transaction Hash:{" "}
                        {notice.transactionHash}
                      </p>
                    )}

                    <p className="text-xs text-amber-800">
                      Do not submit the same credential
                      again. Its blockchain status must be
                      reconciled before verification QR
                      generation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {notice?.kind === "error" && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

                  <div>
                    <h3 className="font-semibold text-destructive">
                      Credential Issuance Failed
                    </h3>

                    <p className="mt-2 text-sm text-foreground">
                      {notice.message}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Check the issuance status before
                      retrying to avoid creating duplicate
                      transactions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {anchored && tokenId && (
              <div className="animate-fade-in-up space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />

                  <h3 className="text-sm font-semibold text-foreground">
                    Credential Successfully Issued
                  </h3>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Token ID:
                  </span>

                  <span className="text-xl font-bold text-primary">
                    {tokenId}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Document Fingerprint:
                  </span>

                  <span className="hash-text break-all text-xs text-foreground">
                    {hash}
                  </span>
                </div>

                <StatusBadge
                  status="anchored"
                  label="Blockchain Confirmed"
                />

                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-muted-foreground">
                      Network
                    </p>
                    <p>Polygon Amoy</p>
                  </div>

                  <div>
                    <p className="font-semibold text-muted-foreground">
                      Block Number
                    </p>
                    <p>
                      {confirmedBlock ?? "Not available"}
                    </p>
                  </div>
                </div>

                {confirmedTransaction && (
                  <p className="break-all text-xs text-muted-foreground">
                    Transaction Hash:{" "}
                    {confirmedTransaction}
                  </p>
                )}
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
                    onClick={() =>
                      window.open(
                        verificationUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
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
