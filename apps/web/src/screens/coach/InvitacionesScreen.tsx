import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as vc from "../../data/vinculoClient";
import { BackButton } from "../../ui/BackButton";
import { Loading } from "../../ui/Loading";

const muted = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" } as const;

// Códigos estables que el backend devuelve en inglés → copy accionable en español (la UI nunca
// muestra el string crudo del server).
const ERR_ES: Record<string, string> = {
  "coach session required": "Necesitás entrar como coach para ver tus invitaciones.",
  "email verification required": "Verificá tu correo antes de confirmar atletas. Te enviamos un enlace al registrarte — podés reenviarlo desde Equipo.",
};
const trErr = (e: unknown, fallback: string): string => {
  const msg = e instanceof Error ? e.message : "";
  return ERR_ES[msg] ?? (msg || fallback);
};

const pillBtn = {
  padding: "6px 12px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)",
  background: "transparent", color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer",
} as const;

export function InvitacionesScreen() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<vc.VinculoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [inv, vs] = await Promise.all([vc.getInvite(), vc.listVinculos()]);
      setCode(inv.inviteCode);
      setVinculos(vs);
    } catch (e) {
      setError(trErr(e, "No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function rotate(): Promise<void> {
    setError(null);
    try {
      setCode((await vc.rotateInvite()).inviteCode);
      setCopied(false);
    } catch (e) {
      setError(trErr(e, "No se pudo generar el código"));
    }
  }

  // Copia al portapapeles con feedback breve. Si el navegador bloquea la API (permiso/contexto
  // inseguro), no rompemos: el código sigue visible para copiar a mano.
  const copy = async (): Promise<void> => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("No se pudo copiar automáticamente — copialo a mano.");
    }
  };

  const confirm = async (id: string): Promise<void> => {
    setError(null);
    try {
      await vc.confirmVinculo(id);
      await refresh();
    } catch (e) {
      setError(trErr(e, "No se pudo confirmar"));
    }
  };
  const deny = async (id: string): Promise<void> => {
    setError(null);
    try {
      await vc.denyVinculo(id);
      await refresh();
    } catch (e) {
      setError(trErr(e, "No se pudo rechazar"));
    }
  };

  const pending = vinculos.filter((v) => v.estado === "pendiente");
  const active = vinculos.filter((v) => v.estado === "activo");

  return (
    <div style={{ padding: "16px 14px 26px", maxWidth: 390, margin: "0 auto", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh" }}>
      <BackButton ariaLabel="Volver al Plantel" onClick={() => navigate("/coach")} />
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, marginTop: 8 }}>Invitaciones</div>

      {error && <div role="alert" style={{ ...muted, color: "var(--wl-danger)", marginTop: 10 }}>{error}</div>}
      {loading ? (
        <Loading style={{ ...muted, padding: "16px 0" }}>Cargando…</Loading>
      ) : (
        <>
          <div style={{ ...muted, marginTop: 16 }}>Tu código de invitación</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, letterSpacing: ".12em", color: "var(--wl-accent)" }}>
              {code ?? "— — — —"}
            </span>
            {code && (
              <button type="button" onClick={() => void copy()} aria-label="Copiar código de invitación"
                style={{ ...pillBtn, ...(copied ? { borderColor: "var(--wl-accent)", color: "var(--wl-accent)" } : {}) }}>
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            )}
            <button type="button" onClick={() => void rotate()} style={pillBtn}>
              {code ? "Rotar" : "Generar"}
            </button>
          </div>
          <div style={{ ...muted, marginTop: 6 }}>Compartilo con tu atleta para que se vincule.</div>

          <div style={{ ...muted, marginTop: 20 }}>Pendientes ({pending.length})</div>
          {pending.length === 0 ? (
            <div style={{ ...muted, marginTop: 6 }}>Sin solicitudes pendientes.</div>
          ) : pending.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
              <b style={{ fontFamily: "var(--wl-display)", fontSize: 13, flex: 1 }}>{v.athlete.nombre}</b>
              <button type="button" onClick={() => void confirm(v.id)}
                style={{ minHeight: 44, padding: "5px 12px", borderRadius: 8, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Confirmar</button>
              <button type="button" onClick={() => void deny(v.id)}
                style={{ minHeight: 44, padding: "5px 12px", borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>Rechazar</button>
            </div>
          ))}

          <div style={{ ...muted, marginTop: 20 }}>Activos ({active.length})</div>
          {active.length === 0 ? (
            <div style={{ ...muted, marginTop: 6 }}>Todavía no hay atletas vinculados.</div>
          ) : active.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
              <b style={{ fontFamily: "var(--wl-display)", fontSize: 13 }}>{v.athlete.nombre}</b>
              <span style={muted}>· activo</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
