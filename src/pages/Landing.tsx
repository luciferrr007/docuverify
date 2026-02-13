import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FeatureCard from "@/components/FeatureCard";
import {
  FileText,
  Database,
  ShieldCheck,
  Lock,
  Fingerprint,
  Ban,
  Search,
  ArrowRight,
} from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/80 to-emerald-50/40" />
        <div className="container relative mx-auto px-4 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Blockchain-Anchored Verification
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
                DocuVerify
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                Decentralized verification of structured document data using
                blockchain-anchored cryptographic integrity proofs.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/issue">
                    Issue Document
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/verify">
                    Verify Document
                    <Search className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Geometric illustration */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative h-72 w-72">
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/10 bg-teal-50/50 rotate-6" />
                <div className="absolute inset-4 rounded-2xl border-2 border-primary/20 bg-card shadow-card -rotate-3" />
                <div className="absolute inset-8 flex flex-col items-center justify-center rounded-2xl bg-card shadow-elevated">
                  <ShieldCheck className="mb-3 h-12 w-12 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Verified</p>
                  <p className="text-xs text-muted-foreground">Integrity Proven</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold text-foreground">How It Works</h2>
          <p className="text-muted-foreground">
            Three pillars of trustless document verification
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={FileText}
            title="Structured Data"
            description="Document fields are captured in a canonical schema, ensuring deterministic representation across systems."
          />
          <FeatureCard
            icon={Database}
            title="Immutable Hash Storage"
            description="A SHA-256 hash of the canonical data is anchored on-chain, creating a tamper-evident fingerprint."
          />
          <FeatureCard
            icon={Search}
            title="Hash-Based Verification"
            description="Re-entering document data regenerates the hash for comparison against the blockchain anchor."
          />
        </div>
      </section>

      {/* Security Features */}
      <section className="border-t bg-card">
        <div className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-foreground">
              Security Features
            </h2>
            <p className="text-muted-foreground">
              Enterprise-grade trust guarantees
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={Lock}
              title="Integrity"
              description="Any modification to the original data invalidates the stored hash."
            />
            <FeatureCard
              icon={Fingerprint}
              title="Authenticity"
              description="Issuer identity is bound to the credential at the time of anchoring."
            />
            <FeatureCard
              icon={Ban}
              title="Non-repudiation"
              description="On-chain records provide irrefutable proof of issuance."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Tamper Detection"
              description="Hash mismatches instantly reveal any unauthorized changes."
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
