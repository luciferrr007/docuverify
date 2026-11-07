import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  RefreshCw,
  Globe,
  Wallet,
  Mail,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  getInstitutionsByStatus,
  approveInstitution,
  rejectInstitution,
  type Institution,
  type InstitutionStatus,
} from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<InstitutionStatus>("pending");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedInstitution, setSelectedInstitution] =
    useState<Institution | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [pendingResult, approvedResult, rejectedResult] =
        await Promise.all([
          getInstitutionsByStatus("pending"),
          getInstitutionsByStatus("approved"),
          getInstitutionsByStatus("rejected"),
        ]);

      setCounts({
        pending: pendingResult.count,
        approved: approvedResult.count,
        rejected: rejectedResult.count,
      });

      const applicationsByStatus = {
        pending: pendingResult.institutions,
        approved: approvedResult.institutions,
        rejected: rejectedResult.institutions,
      };

      setInstitutions(applicationsByStatus[activeTab]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to fetch institution applications.";

      toast.error(message);

      if (
        message.toLowerCase().includes("session") ||
        message.toLowerCase().includes("token")
      ) {
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("adminDetails");
        navigate("/admin/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchDashboardData();
  }

  async function handleApprove(institution: Institution) {
    const confirmed = window.confirm(
      `Are you sure you want to approve ${institution.institutionName}?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(institution._id);

      const response = await approveInstitution(institution._id);

      toast.success(response.message);
      await fetchDashboardData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to approve institution."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function openRejectDialog(institution: Institution) {
    setSelectedInstitution(institution);
    setRejectionReason("");
    setDialogOpen(true);
  }

  async function handleReject() {
    if (!selectedInstitution || !rejectionReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    try {
      setProcessingId(selectedInstitution._id);

      const response = await rejectInstitution(
        selectedInstitution._id,
        rejectionReason.trim()
      );

      toast.success(response.message);

      setDialogOpen(false);
      setSelectedInstitution(null);
      setRejectionReason("");

      await fetchDashboardData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to reject institution."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminDetails");
    toast.success("Logged out successfully.");
    navigate("/admin/login");
  }

  const tabs = [
    { id: "pending" as const, label: "Pending", icon: Clock },
    { id: "approved" as const, label: "Approved", icon: CheckCircle2 },
    { id: "rejected" as const, label: "Rejected", icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">DocuVerify Admin</h1>
              <p className="text-xs text-muted-foreground">
                Institution Management Portal
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h2>
          <p className="mt-2 text-slate-600">
            Manage institution registrations and verification requests.
          </p>
        </div>

        <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pending Applications"
            value={loading ? "..." : String(counts.pending)}
            icon={Clock}
          />
          <StatCard
            title="Approved Institutions"
            value={loading ? "..." : String(counts.approved)}
            icon={CheckCircle2}
          />
          <StatCard
            title="Rejected Applications"
            value={loading ? "..." : String(counts.rejected)}
            icon={XCircle}
          />
        </div>

        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Institution Applications
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review and manage institution registration requests.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      activeTab === tab.id
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
                      {counts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading applications...
              </div>
            ) : institutions.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <h4 className="font-semibold text-slate-800">
                  No {activeTab} applications
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  There are currently no institutions in this category.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {institutions.map((institution) => {
                  const processing = processingId === institution._id;
                  const isPending =
                    institution.applicationStatus === "pending";

                  return (
                    <div
                      key={institution._id}
                      className="rounded-xl border p-5 transition hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">
                            {institution.institutionName}
                          </h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Submitted{" "}
                            {new Date(
                              institution.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <StatusBadge
                          status={institution.applicationStatus}
                        />
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                        <div className="flex items-center gap-2 break-all">
                          <Mail className="h-4 w-4 shrink-0 text-primary" />
                          {institution.officialEmail}
                        </div>

                        <a
                          href={institution.officialWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 break-all hover:text-primary"
                        >
                          <Globe className="h-4 w-4 shrink-0 text-primary" />
                          {institution.officialWebsite}
                        </a>

                        <div className="flex items-center gap-2 break-all sm:col-span-2">
                          <Wallet className="h-4 w-4 shrink-0 text-primary" />
                          {institution.walletAddress}
                        </div>
                      </div>

                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs font-medium text-slate-500">
                          REGISTRATION DETAILS
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                          {institution.registrationDetails}
                        </p>
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground">
                        {institution.verificationDocuments.length} verification
                        document(s) submitted
                      </div>

                      {institution.applicationStatus === "rejected" &&
                        institution.rejectionReason && (
                          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
                            <p className="text-xs font-semibold text-red-700">
                              REJECTION REASON
                            </p>
                            <p className="mt-1 text-sm text-red-800">
                              {institution.rejectionReason}
                            </p>
                          </div>
                        )}

                      {institution.applicationStatus === "approved" &&
                        institution.approvedAt && (
                          <p className="mt-4 text-xs text-emerald-700">
                            Approved on{" "}
                            {new Date(
                              institution.approvedAt
                            ).toLocaleDateString()}
                          </p>
                        )}

                      {isPending && (
                        <div className="mt-5 flex flex-wrap justify-end gap-3 border-t pt-4">
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => openRejectDialog(institution)}
                            disabled={processing}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>

                          <Button
                            onClick={() => handleApprove(institution)}
                            disabled={processing}
                          >
                            {processing ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reject Institution Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting{" "}
              <strong>{selectedInstitution?.institutionName}</strong>.
              This reason will be saved with the application.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Enter the reason for rejection..."
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingId !== null}>
              Cancel
            </AlertDialogCancel>

            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processingId !== null}
            >
              {processingId !== null && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Rejection
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: InstitutionStatus;
}) {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}