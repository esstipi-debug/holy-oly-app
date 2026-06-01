import { useAuth } from "../../auth/AuthContext";

/** Minimal athlete landing (Fase 3). The invite-code entry lands in slice 5; the full
 *  athlete data app is Fase 4. */
export function AtletaScreen() {
  const { logout } = useAuth();
  return (
    <div style={{ padding: "20px 16px", maxWidth: 390, margin: "0 auto", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh" }}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22 }}>Hola 👋</div>
      <p style={{ color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.6, marginTop: 10 }}>
        Tu app de atleta está en camino. Pronto vas a poder vincularte con tu coach con un código y registrar tu monitoreo.
      </p>
      <button type="button" onClick={() => void logout()}
        style={{ marginTop: 16, padding: "8px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Salir
      </button>
    </div>
  );
}
