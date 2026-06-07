import { useState, type FormEvent } from "react";
import type { VinculoEstado } from "@holy-oly/core";
import { useAuth } from "../../auth/AuthContext";
import * as vc from "../../data/vinculoClient";
import { useAtletaCtx } from "./AthleteShell";

const HO_SKINS: Array<{ id: string; nm: string; sw: [string, string, string] }> = [
  { id: "neon", nm: "Neon PR", sw: ["#07070f", "#c8ff2d", "#1fe7ff"] },
  { id: "neonlight", nm: "Neon Bloom", sw: ["#fdeef6", "#ff2e9a", "#8a5cff"] },
  { id: "plates", nm: "Plates", sw: ["#15171a", "#e23b2e", "#2274d4"] },
  { id: "premium", nm: "Premium", sw: ["#0d1016", "#e9b365", "#37d6b8"] },
  { id: "chalk", nm: "Chalk", sw: ["#e7e3d8", "#ff5400", "#2b59ff"] },
];

function VincularSection() {
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
    <div className="ho-acct__group">
      <div className="ho-acct__label">Mi coach</div>
      {estado === "pendiente" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>Solicitud enviada ✓</b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>Esperando que tu coach confirme el vínculo.</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="ho-card">
          <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>Ingresá el código que te pasó tu coach. Cuando lo confirme, queda hecho el vínculo.</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO"
            aria-label="Código de invitación"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, letterSpacing: ".18em", textAlign: "center" }}
          />
          {error && <div role="alert" style={{ color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11, marginTop: 10 }}>{error}</div>}
          <button type="submit" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={busy || !code.trim()}>
            {busy ? "..." : "Enviar solicitud"}
          </button>
        </form>
      )}
    </div>
  );
}

export function CuentaMin() {
  const { logout } = useAuth();
  const { skin, setSkin, variant, setVariant } = useAtletaCtx();
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">Cuenta</div><div className="ho-greet__s">tus datos son tuyos</div></div>

      <VincularSection />

      <div className="ho-acct__group">
        <div className="ho-acct__label">Check-in · interacción</div>
        <div className="ho-seg">
          {([["tap", "Toque"], ["dial", "Dial"]] as const).map(([v, l]) => (
            <button key={v} className={variant === v ? "on" : ""} onClick={() => setVariant(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="ho-acct__group">
        <div className="ho-acct__label">Apariencia · skin</div>
        <div className="ho-skins">
          {HO_SKINS.map((s) => (
            <button key={s.id} className={"ho-skin" + (skin === s.id ? " on" : "")} onClick={() => setSkin(s.id)} aria-label={`Skin ${s.nm}`}>
              <div className="ho-skin__sw">{s.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              <div className="ho-skin__nm">{s.nm}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="ho-acct__group">
        <button type="button" onClick={() => void logout()} className="wl-btn wl-btn--ghost" style={{ width: "100%", color: "#ff5e5e" }}>Cerrar sesión</button>
      </div>

      <div style={{ textAlign: "center", fontFamily: "var(--ho-mono)", fontSize: 9, color: "var(--wl-muted)", margin: "22px 0 4px", letterSpacing: ".04em" }}>
        HOLY OLY · smart training · zero burnout
      </div>
    </>
  );
}
