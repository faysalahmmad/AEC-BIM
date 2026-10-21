import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function CallbackPage() {
  const { status } = useAuth();

  if (status === "authenticated") return <Navigate to="/" replace />;

  if (status === "unauthenticated") {
    return (
      <div>
        <h1>Sign-in failed</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          The link may have expired or already been used.
        </p>
        <Link to="/login">Back to login</Link>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Completing sign-in...</p>;
}
