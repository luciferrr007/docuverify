
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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Institution } from "@/lib/api";

export default function InstitutionDashboard() {
  const navigate = useNavigate();
  const [institution, setInstitution] = useState<Institution | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("institutionToken");
    const storedInstitution = sessionStorage.getItem("institution");

    if (!token || !storedInstitution) {
      toast.error("Please log in to access your institution dashboard.");
      navigate("/institution/login", { replace: true });
      return;
    }

    try {
      setInstitution(JSON.parse(storedInstitution) as Institution);
    } catch {
      sessionStorage.removeItem("institution");
      sessionStorage.removeItem("institutionToken");
      toast.error("Session information is invalid. Please log in again.");
      navigate("/institution/login", { replace: true });
    }
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem("institutionToken");
    sessionStorage.removeItem("institution");

    toast.success("You have been logged out.");
    navigate("/institution/login", { replace: true });
  }

  if (!institution) {
    return null;
  }

  const isApproved = institution.applicationStatus === "approved";
  const isRejected = institution.applicationStatus === "rejected";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
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

          <Button variant="outline" onClick={handleLogout}>
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
                <ShieldCheck className="h-6 w-6 text-green-700" />
                <div>
                  <p className="font-semibold text-green-800">
                    Application Approved
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    Your institution has been approved. You can now issue
                    credentials through DocuVerify.
                  </p>
                </div>
              </div>

              {institution.approvedAt && (
                <p className="mt-3 text-xs text-green-700">
                  Approved on:{" "}
                  {new Date(institution.approvedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {!isApproved && !isRejected && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-700" />
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
                <XCircle className="h-6 w-6 text-red-700" />
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
          <h2 className="text-lg font-semibold text-foreground">
            Credential Management
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Issue and manage digital credentials for your institution.
          </p>

          <div className="mt-5">
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
      </div>
    </div>
  );
}
