import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { Loading } from "../ui/Loading";

/**
 * Guard del panel del dueño. Independiente del rol: exige sesión cuyo `isAdmin` sea true (lo decide
 * el server vía ADMIN_EMAILS). Es solo cosmético — cada endpoint /admin re-chequea server-side. Sin
 * API (modo demo) no hay panel → a "/". No-admin logueado → a "/" (RoleLanding despacha por rol).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { apiEnabled, user, loading } = useAuth();
  if (!apiEnabled) return <Navigate to="/" replace />;
  if (loading) return <Loading style={{ padding: 24, fontFamily: "var(--mono)" }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
