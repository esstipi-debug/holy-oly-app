import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";

const page: CSSProperties = {
  padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
};
const row: CSSProperties = {
  display: "block", textDecoration: "none", color: "var(--wl-text)", fontFamily: "var(--wl-display)",
  fontWeight: 600, fontSize: 15, padding: "14px 14px", borderRadius: 12, marginTop: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", background: "var(--wl-surface)",
};

/** Account tab stub: identity + Invitaciones (relocated here) + logout. Profile/subscription land in Slice D.
 *  Invitaciones y logout son 100% API → en modo demo (apiEnabled=false) no se renderizan. */
export function CuentaStub() {
  const { apiEnabled, user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function onLogout(): void {
    setLogoutError(null);
    logout().catch(() => setLogoutError("No se pudo cerrar la sesión. Probá de nuevo."));
  }

  return (
    <div style={page}>
      <h1 style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1, margin: 0 }}>Cuenta</h1>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
        {apiEnabled && user ? `Sesión activa · ${user.role}` : "modo demo"}
      </div>

      {apiEnabled && <Link to="/coach/invitaciones" style={row}>Invitaciones ›</Link>}
      {apiEnabled && <Link to="/coach/suscripcion" style={row}>Suscripción ›</Link>}

      {apiEnabled && (
        <>
          <button
            type="button"
            onClick={onLogout}
            style={{ ...row, width: "100%", textAlign: "left", cursor: "pointer", color: "var(--wl-danger)" }}
          >
            Cerrar sesión
          </button>
          {logoutError && (
            <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
              {logoutError}
            </div>
          )}
        </>
      )}

      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 16, lineHeight: 1.5 }}>
        <Link to="/privacidad" style={{ color: "inherit" }}>Privacidad</Link>
        {" · "}
        <Link to="/terminos" style={{ color: "inherit" }}>Términos</Link>
      </div>
    </div>
  );
}
