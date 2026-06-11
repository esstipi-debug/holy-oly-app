import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Role } from "./authClient";

/**
 * Route guard. In standalone (no API) mode it's a pass-through. In API mode it requires a
 * session (redirecting to /login) and, optionally, a specific role — a logged-in user with the
 * wrong role goes to "/" (RoleLanding dispatches by role), nunca de vuelta al form de login.
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { apiEnabled, user, loading } = useAuth();
  if (!apiEnabled) return <>{children}</>;
  if (loading) {
    return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
