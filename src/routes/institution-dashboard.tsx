
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Mail,
  Wallet,
  ShieldCheck,
  Clock,
  XCircle,
  LogOut,
  FilePlus2,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  getInstitutionCredentials,
  institutionLogout,
} from "@/lib/api";

import type {
  Institution,
  InstitutionCredential,
  InstitutionCredentialsResponse,
  BlockchainStatus,
} from "@/lib/api";

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusStyle(status: BlockchainStatus): string {
  switch (status) {
    case "confirmed":
      return "border-green-200 bg-green-50 text-green-700";

    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function statusLabel(status: BlockchainStatus): string {
  if (status === "not_registered") {
    return "Not Registered";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function supportsDirectVerification(tokenId: string): boolean {
  return /^DCR-\d{4}-[0-9A-F]{8}$/i.test(tokenId);
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {label}
        </p>

        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      <p className="text-3xl font-bold text-foreground">
        {value}
      </p>
    </div>
  );
}

export default function InstitutionDashboard() {
  const navigate = useNavigate();

  const [institution, setInstitution] =
    useState<Institution | null>(null);

  const [page, setPage] = useState(1);
  const [refreshCount, setRefreshCount] = useState(0);

  const [history, setHistory] =
    useState<InstitutionCredentialsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("institutionToken");
    const storedInstitution = sessionStorage.getItem("institution");

    if (!token || !storedInstitution) {
      toast.error(
        "Please log in to access your institution dashboard."
      );

      navigate("/institution/login", {
        replace: true,
      });

      return;
    }

    try {
      const parsed = JSON.parse(
        storedInstitution
      ) as Institution;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.walletAddress ||
        !parsed.institutionName
      ) {
        throw new Error("Invalid institution session.");
      }

      setInstitution(parsed);
    } catch {
      institutionLogout();

      toast.error(
        "Session information is invalid. Please log in again."
      );

      navigate("/institution/login", {
        replace: true,
      });
    }
  }, [navigate]);

  useEffect(() => {
    if (!institution) return;

    if (institution.applicationStatus !== "approved") {
      setLoading(false);
      setHistory(null);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setHistoryError("");

    getInstitutionCredentials(
      page,
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted) return;

        setHistory(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load credentials.";

        setHistoryError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [institution, page, refreshCount]);

  function handleLogout() {
    institutionLogout();
    toast.success("You have been logged out.");

    navigate("/institution/login", {
      replace: true,
    });
  }

  function refreshHistory() {
    setRefreshCount((count) => count + 1);
  }

  async function copyTokenId(tokenId: string) {
    try {
      await navigator.clipboard.writeText(tokenId);
      toast.success("Token ID copied.");
    } catch {
      toast.error("Unable to copy Token ID.");
    }
  }

  if (!institution) {
    return null;
  }

  const isApproved =
    institution.applicationStatus === "approved";

  const isRejected =
    institution.applicationStatus === "rejected";

  const credentials: InstitutionCredential[] =
    history?.credentials ?? [];

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <h1 className="text-2xl font-bold text-foreground">
              Institution Dashboard
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage your institution account and credentials.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {institution.institutionName}
              </h2>

              <p className="text-sm text-muted-foreground">
                Registered Institution
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 h-4 w-4 text-muted-foreground" />

              <div>
                <p className="text-xs text-muted-foreground">
                  Official Email
                </p>

                <p className="break-all text-sm font-medium text-foreground">
                  {institution.officialEmail}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Wallet className="mt-1 h-4 w-4 text-muted-foreground" />

              <div>
                <p className="text-xs text-muted-foreground">
                  Wallet Address
                </p>

                <p className="break-all text-sm font-medium text-foreground">
                  {institution.walletAddress}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Application Status
          </h2>

          {isApproved && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 shrink-0 text-green-700" />

                <div>
                  <p className="font-semibold text-green-800">
                    Application Approved
                  </p>

                  <p className="mt-1 text-sm text-green-700">
                    Your institution has been approved.
                    You can now issue credentials through DocuVerify.
                  </p>
                </div>
              </div>

              {institution.approvedAt && (
                <p className="mt-3 text-xs text-green-700">
                  Approved on:{" "}
                  {formatDate(institution.approvedAt)}
                </p>
              )}
            </div>
          )}

          {!isApproved && !isRejected && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 shrink-0 text-amber-700" />

                <div>
                  <p className="font-semibold text-amber-800">
                    Application Pending
                  </p>

                  <p className="mt-1 text-sm text-amber-700">
                    Your application is awaiting administrator review.
                    Credential issuance will become available after approval.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 shrink-0 text-red-700" />

                <div>
                  <p className="font-semibold text-red-800">
                    Application Rejected
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    Your institution's application was not approved.
                  </p>
                </div>
              </div>

              {institution.rejectionReason && (
                <div className="mt-4 rounded-md bg-white/70 p-3">
                  <p className="text-xs font-semibold text-red-800">
                    Administrator's Reason
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {institution.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Credential Management
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Issue and manage digital credentials for your institution.
              </p>
            </div>

            {isApproved ? (
              <Button asChild>
                <Link to="/issue">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Issue Credentials
                </Link>
              </Button>
            ) : (
              <Button disabled>
                <FilePlus2 className="mr-2 h-4 w-4" />
                Issue Credentials
              </Button>
            )}
          </div>

          {!isApproved && (
            <p className="mt-3 text-xs text-muted-foreground">
              This feature will become available once your institution
              receives administrator approval.
            </p>
          )}
        </div>

        {isApproved && (
          <>
            <div className="mt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Credential Overview
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Statistics from your institution's MongoDB records.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={refreshHistory}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              </div>

              {loading && !history ? (
                <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  Loading credential statistics...
                </div>
              ) : history ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Total Credentials"
                    value={history.summary.total}
                    icon={FileText}
                  />

                  <StatCard
                    label="Confirmed"
                    value={history.summary.confirmed}
                    icon={CheckCircle2}
                  />

                  <StatCard
                    label="Pending"
                    value={history.summary.pending}
                    icon={Clock}
                  />

                  <StatCard
                    label="Failed"
                    value={history.summary.failed}
                    icon={AlertCircle}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Issued Credentials
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Credentials registered by your institution.
                  </p>
                </div>

                {history && (
                  <span className="text-sm text-muted-foreground">
                    {history.total} total
                  </span>
                )}
              </div>

              {historyError && (
                <div
                  role="alert"
                  className="m-5 rounded-lg border border-red-200 bg-red-50 p-4"
                >
                  <p className="text-sm font-medium text-red-800">
                    Unable to load credential history
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {historyError}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={refreshHistory}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {loading && (
                <p className="p-6 text-sm text-muted-foreground">
                  Loading credential records...
                </p>
              )}

              {!loading &&
                !historyError &&
                credentials.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground" />

                    <h3 className="mt-4 font-semibold text-foreground">
                      No Credentials Found
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      No credentials have been recorded for your
                      institution yet.
                    </p>

                    <Button asChild className="mt-5">
                      <Link to="/issue">
                        <FilePlus2 className="mr-2 h-4 w-4" />
                        Issue Credential
                      </Link>
                    </Button>
                  </div>
                )}

              {!loading &&
                !historyError &&
                credentials.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-5 py-4 font-medium">
                            Token ID
                          </th>

                          <th className="px-5 py-4 font-medium">
                            Document Type
                          </th>

                          <th className="px-5 py-4 font-medium">
                            Issued On
                          </th>

                          <th className="px-5 py-4 font-medium">
                            Blockchain Status
                          </th>

                          <th className="px-5 py-4 font-medium">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {credentials.map((credential) => (
                          <tr
                            key={credential.tokenId}
                            className="hover:bg-muted/30"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-medium text-foreground">
                                  {credential.tokenId}
                                </span>

                                <button
                                  type="button"
                                  title="Copy Token ID"
                                  aria-label={`Copy ${credential.tokenId}`}
                                  onClick={() =>
                                    copyTokenId(
                                      credential.tokenId
                                    )
                                  }
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>

                              {credential.status === "revoked" && (
                                <span className="mt-1 inline-block text-xs text-red-600">
                                  Revoked
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-foreground">
                              {credential.documentType}
                            </td>

                            <td className="px-5 py-4 text-muted-foreground">
                              {formatDate(
                                credential.issuedAt ||
                                  credential.createdAt
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                                  credential.blockchainStatus
                                )}`}
                              >
                                {statusLabel(
                                  credential.blockchainStatus
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {credential.blockchainStatus ===
                              "confirmed" ? (
                                supportsDirectVerification(
                                  credential.tokenId
                                ) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                  >
                                    <Link
                                      to={`/verify?tokenId=${encodeURIComponent(
                                        credential.tokenId
                                      )}`}
                                    >
                                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                      Verify
                                    </Link>
                                  </Button>
                                ) : (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    title="Legacy test Token ID format is not supported by the current verification page."
                                  >
                                    Legacy Token
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Not verified
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {!loading &&
                !historyError &&
                history &&
                history.totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                      Page {history.page} of{" "}
                      {history.totalPages}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() =>
                          setPage((value) =>
                            Math.max(1, value - 1)
                          )
                        }
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          page >= history.totalPages
                        }
                        onClick={() =>
                          setPage((value) => value + 1)
                        }
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
