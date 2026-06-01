import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as vc from "../../data/vinculoClient";

const muted = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" } as const;

export function InvitacionesScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<vc.VinculoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [inv, vs] = await Promise.all([vc.getInvite(), vc.listVinculos()]);
      setCode(inv.inviteCode);
      setVinculos(vs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function rotate(): Promise<void> {
    setError(null);
    try {
      setCode((await vc.rotateInvite()).inviteCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el código");
    }
  }
  const confirm = async (id: string): Promise<void> => {
    setError(null);
    try {
      await vc.confirmVinculo(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar");
    }
  };
  const deny = async (id: string): Promise<void> => {
    setError(null);
    try {
      await vc.denyVinculo(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rechazar");
    }
  };

  const pending = vinculos.filter((v) => v.estado === "pendiente");
  const active = vinculos.filter((v) => v.estado === "activo");

  return (
    <div style={{ padding: "16px 14px 26px", maxWidth: 390, margin: "0 auto", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh" }}>
      <Link to="/coach" style={{ ...muted, textDecoration: "none" }}>‹ Plantel</Link>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, marginTop: 8 }}>Invitaciones</div>

      {error && <div role="alert" style={{ ...muted, color: "#ff3b46", marginTop: 10 }}>{error}</div>}
      {loading ? (
        <div aria-busy="true" style={{ ...muted, padding: "16px 0" }}>Cargando…</div>
      ) : (
        <>
          <div style={{ ...muted, marginTop: 16 }}>Tu código de invitación</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, letterSpacing: ".12em", color: "var(--wl-accent)" }}>
              {code ?? "— — — —"}
            </span>
            <button type="button" onClick={() => void rotate()}
              style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>
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
                style={{ padding: "5px 10px", borderRadius: 8, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Confirmar</button>
              <button type="button" onClick={() => void deny(v.id)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>Rechazar</button>
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
