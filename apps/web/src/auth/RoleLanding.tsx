import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loading } from "../ui/Loading";

/** Sends each principal to their home. Standalone (no API) → the coach demo screen. */
export function RoleLanding() {
  const { apiEnabled, user, loading } = useAuth();
  if (!apiEnabled) return <Navigate to="/coach" replace />;
  if (loading) {
    return <Loading style={{ padding: 24, fontFamily: "var(--mono)" }} />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "coach" ? "/coach" : "/atleta"} replace />;
}
