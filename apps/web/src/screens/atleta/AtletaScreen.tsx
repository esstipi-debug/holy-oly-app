import { useState, type FormEvent } from "react";
import type { VinculoEstado } from "@holy-oly/core";
import { useAuth } from "../../auth/AuthContext";
import * as vc from "../../data/vinculoClient";

const muted = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" } as const;

export function AtletaScreen() {
  const { logout } = useAuth();
  const [code, setCode] = useState("");
  const [estado, setEstado] = useState<VinculoEstado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await vc.acceptCode(code.trim().toUpperCase());
      setEstado(r.estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 390, margin: "0 auto", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh" }}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22 }}>Vincularte con tu coach</div>
      <p style={{ ...muted, lineHeight: 1.6, marginTop: 8 }}>
        Ingresá el código que te pasó tu coach. Cuando lo confirme, vas a quedar vinculado.
      </p>

      {estado === "pendiente" ? (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", border: "1px solid color-mix(in srgb,var(--wl-accent) 40%,transparent)" }}>
          <b style={{ fontFamily: "var(--wl-display)" }}>Solicitud enviada ✓</b>
          <div style={{ ...muted, marginTop: 4 }}>Esperando que tu coach confirme el vínculo.</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO"
            aria-label="Código de invitación"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, letterSpacing: ".18em", textAlign: "center" }}
          />
          {error && <div role="alert" style={{ ...muted, color: "#ff3b46", marginTop: 10 }}>{error}</div>}
          <button type="submit" disabled={busy || !code.trim()}
            style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy || !code.trim() ? 0.6 : 1 }}>
            {busy ? "..." : "Enviar solicitud"}
          </button>
        </form>
      )}

      <button type="button" onClick={() => void logout()}
        style={{ marginTop: 18, padding: "8px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        Salir
      </button>
    </div>
  );
}
