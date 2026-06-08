import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "./authClient";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--wl-surface)", borderRadius: 18, padding: 20, border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontSize: 20 }}>Recuperar contraseña</h1>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8 }}>
          Si el email existe, te enviamos un enlace (revisá también spam).
        </p>
        {!sent ? (
          <>
            <label style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 12, display: "block" }}>Email</label>
            <input style={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontWeight: 800, cursor: busy ? "default" : "pointer" }}>
              {busy ? "..." : "Enviar enlace"}
            </button>
          </>
        ) : (
          <p style={{ marginTop: 16, color: "var(--wl-text)" }}>Listo. Si el email está registrado, vas a recibir instrucciones en breve.</p>
        )}
        <Link to="/login" style={{ display: "block", marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>Volver al login</Link>
      </form>
    </div>
  );
}
