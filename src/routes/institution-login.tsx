
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { institutionLogin } from "@/lib/api";

export default function InstitutionLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please enter your institutional email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await institutionLogin(email.trim(), password);

      toast.success("Login successful!");

      if (response.institution.applicationStatus === "approved") {
        navigate("/institution/dashboard");
      } else {
        navigate("/institution/dashboard");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to log in. Please try again.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-background to-emerald-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to DocuVerify
        </Link>

        <div className="rounded-2xl border bg-card p-8 shadow-xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-9 w-9 text-primary" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Institution Portal
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to manage your institution account
            </p>
          </div>

          <div className="mb-7 flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <LockKeyhole className="h-5 w-5 shrink-0 text-primary" />

            <div>
              <p className="text-sm font-medium text-foreground">
                Secure Institution Access
              </p>
              <p className="text-xs text-muted-foreground">
                Registered institutions only
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Institutional Email Address</Label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  id="email"
                  type="email"
                  placeholder="institution@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 pl-10"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 pl-10 pr-11"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an institution account?{" "}
              <Link
                to="/institution/register"
                className="font-medium text-primary hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-7 border-t pt-5 text-center">
            <p className="text-xs text-muted-foreground">
              DocuVerify · Blockchain-Anchored Credential Verification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
