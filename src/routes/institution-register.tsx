
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Globe,
  Wallet,
  FileText,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerInstitution } from "@/lib/api";

export default function InstitutionRegister() {
  const navigate = useNavigate();

  const [institutionName, setInstitutionName] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationDetails, setRegistrationDetails] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
      toast.error("Please enter a valid Ethereum wallet address.");
      return;
    }

    try {
      setLoading(true);

      await registerInstitution({
        institutionName: institutionName.trim(),
        officialWebsite: officialWebsite.trim(),
        officialEmail: officialEmail.trim(),
        password,
        registrationDetails: registrationDetails.trim(),
        walletAddress: walletAddress.trim(),
      });

      toast.success("Institution application submitted successfully!");

      navigate("/institution/login");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit your application. Please try again.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-background to-emerald-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/institution/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Institution Login
        </Link>

        <div className="rounded-2xl border bg-card p-6 shadow-xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-9 w-9 text-primary" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Institution Registration
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Register your institution to issue blockchain-verified credentials
            </p>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Manual Verification Required
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your application will be reviewed by a DocuVerify administrator.
                You can log in to check its status, but credential issuance will
                only be available after approval.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="institutionName">Institution Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="institutionName"
                  placeholder="Enter institution name"
                  value={institutionName}
                  onChange={(event) => setInstitutionName(event.target.value)}
                  className="h-11 pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="officialWebsite">Official Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="officialWebsite"
                  type="url"
                  placeholder="https://www.example.edu"
                  value={officialWebsite}
                  onChange={(event) => setOfficialWebsite(event.target.value)}
                  className="h-11 pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="officialEmail">Official Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="officialEmail"
                  type="email"
                  placeholder="admin@example.edu"
                  value={officialEmail}
                  onChange={(event) => setOfficialEmail(event.target.value)}
                  className="h-11 pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 pl-10 pr-10"
                    autoComplete="new-password"
                    minLength={8}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 pl-10"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationDetails">
                Registration Details
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="registrationDetails"
                  placeholder="Enter official registration number and other relevant institutional details"
                  value={registrationDetails}
                  onChange={(event) => setRegistrationDetails(event.target.value)}
                  className="flex min-h-28 w-full rounded-md border border-input bg-background px-10 py-3 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Institution Wallet Address</Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="walletAddress"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(event) => setWalletAddress(event.target.value)}
                  className="h-11 pl-10"
                  spellCheck={false}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the public wallet address that your institution intends
                to use for credential issuance. Never enter your private key
                or recovery phrase.
              </p>
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                "Submit Registration"
              )}
            </Button>
          </form>

          <div className="mt-7 border-t pt-5 text-center">
            <p className="text-sm text-muted-foreground">
              Already registered?{" "}
              <Link
                to="/institution/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              DocuVerify · Blockchain-Anchored Credential Verification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
