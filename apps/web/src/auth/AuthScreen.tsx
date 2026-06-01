import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./authClient";
import { HolyOlyIcon } from "../ui/HolyOlyIcon";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};
const label: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)", marginTop: 12, display: "block" };

export function AuthScreen() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("coach");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, role, name || undefined);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wl-bg)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={onSubmit} style={{ width: "100%", maxWidth: 360, background: "var(--wl-surface)", borderRadius: 18, padding: "22px 20px", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <HolyOlyIcon size={88} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
            {mode === "login" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}
          </div>
        </div>

        {mode === "signup" && (
          <>
            <label style={label}>Soy</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(["coach", "atleta"] as const).map((r) => (
                <button type="button" key={r} onClick={() => setRole(r)}
                  style={{ flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--wl-display)", fontWeight: 700,
                    border: `1px solid ${role === r ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 16%,transparent)"}`,
                    background: role === r ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "transparent", color: "var(--wl-text)" }}>
                  {r === "coach" ? "Coach" : "Atleta"}
                </button>
              ))}
            </div>
            <label style={label}>Nombre</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </>
        )}

        <label style={label}>Email</label>
        <input style={input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" />
        <label style={label}>Contraseña</label>
        <input style={input} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

        {error && <div role="alert" style={{ marginTop: 12, color: "#ff3b46", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
          {busy ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
        </button>

        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          style={{ width: "100%", marginTop: 10, padding: 8, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
          {mode === "login" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Ingresá"}
        </button>
      </form>
    </div>
  );
}
