
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Shield,
  Building2,
  ShieldCheck,
  ChevronDown,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const [portalsOpen, setPortalsOpen] = useState(false);

  // Check the current session.
  const adminToken = sessionStorage.getItem("adminToken");
  const institutionToken = sessionStorage.getItem("institutionToken");

  let institution: {
    institutionName?: string;
    applicationStatus?: string;
  } | null = null;

  try {
    const storedInstitution = sessionStorage.getItem("institution");

    if (storedInstitution) {
      institution = JSON.parse(storedInstitution);
    }
  } catch {
    institution = null;
  }

  const isAdminLoggedIn = Boolean(adminToken);

  const isInstitutionLoggedIn =
    Boolean(institutionToken) && Boolean(institution);

  const isInstitutionApproved =
    isInstitutionLoggedIn &&
    institution?.applicationStatus === "approved";

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      pathname === path
        ? "text-primary"
        : "text-muted-foreground"
    }`;

  function handleLogout() {
    if (isAdminLoggedIn) {
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminDetails");
    }

    if (isInstitutionLoggedIn) {
      sessionStorage.removeItem("institutionToken");
      sessionStorage.removeItem("institution");
    }

    toastLogout();
    setPortalsOpen(false);
    navigate("/");
  }

  function toastLogout() {
    // Logout is completed locally.
    // The login pages will request fresh authentication next time.
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            DocuVerify
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">

          {/* Public navigation */}
          <Link to="/" className={linkClass("/")}>
            Home
          </Link>

          <Link to="/verify" className={linkClass("/verify")}>
            Verify
          </Link>

          {/* Issue is visible only to approved institutions */}
          {isInstitutionApproved && (
            <Link to="/issue" className={linkClass("/issue")}>
              Issue
            </Link>
          )}

          {/* Institution account navigation */}
          {isInstitutionLoggedIn && (
            <Link
              to="/institution/dashboard"
              className={`flex items-center gap-1 ${linkClass(
                "/institution/dashboard"
              )}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          )}

          {/* Admin navigation */}
          {isAdminLoggedIn && (
            <Link
              to="/admin/dashboard"
              className={`flex items-center gap-1 ${linkClass(
                "/admin/dashboard"
              )}`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Dashboard
            </Link>
          )}

          {/* Portals dropdown for visitors */}
          {!isAdminLoggedIn && !isInstitutionLoggedIn && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPortalsOpen(!portalsOpen)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Portals
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    portalsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {portalsOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border bg-card shadow-lg">
                  <Link
                    to="/institution/login"
                    onClick={() => setPortalsOpen(false)}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-muted"
                  >
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Institution Portal
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Login or register
                      </p>
                    </div>
                  </Link>

                  <div className="border-t" />

                  <Link
                    to="/admin/login"
                    onClick={() => setPortalsOpen(false)}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-muted"
                  >
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Admin Portal
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Administrator access
                      </p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          {(isAdminLoggedIn || isInstitutionLoggedIn) && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
