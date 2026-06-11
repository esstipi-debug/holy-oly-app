import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "./authClient";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};

export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      // state.resetOk → AuthScreen muestra "Contraseña actualizada — ingresá de nuevo."
      navigate("/login", { replace: true, state: { resetOk: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
        <p style={{ color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14 }}>
          Enlace inválido. <Link to="/login/forgot" style={{ color: "var(--wl-accent)" }}>Pedí uno nuevo</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--wl-surface)", borderRadius: 18, padding: 20 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontSize: 20, color: "var(--wl-text)" }}>Nueva contraseña</h1>
        <label style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 12, display: "block" }}>Contraseña (mín. 12)</label>
        <input style={input} type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontSize: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}
