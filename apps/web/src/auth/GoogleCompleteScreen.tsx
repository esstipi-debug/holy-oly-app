import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Role } from "./authClient";
import { completeGoogleSignup } from "./authClient";
import { HolyOlyIcon } from "../ui/HolyOlyIcon";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14,
};
const label: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)", marginTop: 12, display: "block" };

export function GoogleCompleteScreen() {
  const [role, setRole] = useState<Role>("coach");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await completeGoogleSignup(role, name || undefined);
      window.location.replace("/");
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
          <HolyOlyIcon size={72} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", textAlign: "center" }}>
            Google conectó tu cuenta. Elegí cómo usar Holy Oly.
          </div>
        </div>

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

        {error && <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, opacity: busy ? 0.6 : 1 }}>
          {busy ? "..." : "Continuar"}
        </button>

        <Link to="/login" style={{ display: "block", marginTop: 12, textAlign: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          Volver al login
        </Link>
      </form>
    </div>
  );
}
