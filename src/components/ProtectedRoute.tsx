import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading session...</p>;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;

  return <Outlet />;
}
