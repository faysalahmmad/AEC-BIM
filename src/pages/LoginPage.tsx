import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import sso from "../lib/sso";
import { useAuth } from "../context/AuthContext";
import "./AuthForm.css";

type Mode = "link" | "code";
type Step = "form" | "sent" | "verify";

const callbackUrl = `${window.location.origin}/callback`;

export default function LoginPage() {
  const { status } = useAuth();
  const [mode, setMode] = useState<Mode>("link");
  const [step, setStep] = useState<Step>("form");
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
        await sso.login({ email, redirectUri: callbackUrl });
      } else {
        await sso.login({ email, type: "otp" });
      }
      setStep(mode === "link" ? "sent" : "verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
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

  const handleHostedSso = async () => {
    setError(null);
    try {
      await sso.login(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SSO redirect failed.");
    }
  };

  return (
    <div className="auth-form">
      <h1>Log in</h1>

      {step === "sent" && (
        <p className="auth-form-info">
          Check <strong>{email}</strong> for a sign-in link, then open it in this browser.
        </p>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify}>
          <p className="auth-form-info">
            Enter the code we emailed to <strong>{email}</strong>.
          </p>
          <label>
            Code
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              inputMode="numeric"
              autoFocus
              required
            />
          </label>
          {error && <p className="auth-form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Verifying..." : "Verify code"}
          </button>
        </form>
      )}

      {step === "form" && (
        <>
          <div className="auth-form-mode">
            <button
              type="button"
              className={mode === "link" ? "active" : ""}
              onClick={() => setMode("link")}
            >
              Email me a link
            </button>
            <button
              type="button"
              className={mode === "code" ? "active" : ""}
              onClick={() => setMode("code")}
            >
              Email me a code
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error && <p className="auth-form-error">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : mode === "link" ? "Send link" : "Send code"}
            </button>
          </form>

          <div className="auth-form-divider">or</div>

          <button type="button" onClick={handleHostedSso}>
            Continue with hosted SSO
          </button>
        </>
      )}

      <p className="auth-form-switch">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
