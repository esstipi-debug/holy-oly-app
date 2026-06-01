import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** Sends each principal to their home. Standalone (no API) → the coach demo screen. */
export function RoleLanding() {
  const { apiEnabled, user, loading } = useAuth();
  if (!apiEnabled) return <Navigate to="/coach" replace />;
  if (loading) {
    return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "coach" ? "/coach" : "/atleta"} replace />;
}
