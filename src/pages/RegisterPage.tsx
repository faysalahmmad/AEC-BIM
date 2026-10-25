import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { sso } from "@/lib/allium/avatar-sso";
import { useAuth } from "../context/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "link" | "code";
type Step = "form" | "sent" | "verify";

const callbackUrl = `${window.location.origin}/callback`;

export default function RegisterPage() {
  const { status } = useAuth();
  const [mode, setMode] = useState<Mode>("link");
  const [step, setStep] = useState<Step>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "link") {
        await sso.register({ firstName, lastName, email, redirectUri: callbackUrl });
      } else {
        await sso.register({ firstName, lastName, email, type: "otp" });
      }
      setStep(mode === "link" ? "sent" : "verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sso.verifyOtp({ email, otpCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setError(null);
    setOtpCode("");
    setStep("form");
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 text-left">
      <div>
        <h1 className="mb-1">Register</h1>
        <p className="text-sm text-muted-foreground">Create your Avatar SSO account.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          {step === "sent" && (
            <>
              <Alert>
                <AlertDescription>
                  Check <strong className="text-foreground">{email}</strong> for a confirmation
                  link, then open it in this browser.
                </AlertDescription>
              </Alert>
              <Button type="button" variant="ghost" onClick={startOver}>
                Use a different email
              </Button>
            </>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Enter the code we emailed to <strong className="text-foreground">{email}</strong>.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="otp">Code</Label>
                <Input
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify code"}
              </Button>
              <Button type="button" variant="ghost" onClick={startOver}>
                Use a different email
              </Button>
            </form>
          )}

          {step === "form" && (
            <div className="flex flex-col gap-5">
              <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="link">Email me a link</TabsTrigger>
                  <TabsTrigger value="code">Email me a code</TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Sending..." : mode === "link" ? "Send link" : "Send code"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium">
          Log in
        </Link>
      </p>
    </div>
  );
}
