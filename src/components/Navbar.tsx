import { Link, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors hover:text-primary ${
      location.pathname === path ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground tracking-tight">
            DocuVerify
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className={linkClass("/")}>
            Home
          </Link>
          <Link to="/issue" className={linkClass("/issue")}>
            Issue
          </Link>
          <Link to="/verify" className={linkClass("/verify")}>
            Verify
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
