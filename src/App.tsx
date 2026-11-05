import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import Landing from "@/routes/index";
import IssuePage from "@/routes/issue";
import VerifyPage from "@/routes/verify";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorPage() {
  const error = useRouteError();

  let message = "Something went wrong. Please try again.";

  if (isRouteErrorResponse(error)) {
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link to="/" className="mt-6 inline-flex rounded-md border border-input px-4 py-2 text-sm">
          Go home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/docuverify">
      <TooltipProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/issue" element={<IssuePage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          <Footer />
        </div>

        <Sonner />
      </TooltipProvider>
    </BrowserRouter>
  );
}
