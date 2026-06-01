import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { getRosterRows, type RosterRow } from "./roster";
import { Heatmap } from "../../ui/charts/Heatmap";
import { RiskQuadrant, type QuadPoint, type NoDataPoint } from "../../ui/charts/RiskQuadrant";
import { Badge } from "../../ui/Badge";
import { STATUS } from "../../ui/status";

export function Equipo() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(false);
    getRosterRows(repo)
      .then((r) => { if (on) { setRows(r); setLoading(false); } })
      .catch(() => { if (on) { setError(true); setLoading(false); } });
    return () => { on = false; };
  }, [repo]);

  const counts = useMemo(() => ({
    alert: rows.filter((r) => r.cell === "alert").length,
    warn: rows.filter((r) => r.cell === "warn").length,
    ok: rows.filter((r) => r.cell === "ok").length,
    none: rows.filter((r) => r.cell === "none").length,
  }), [rows]);

  const points: QuadPoint[] = rows
    .filter((r) => r.acwr != null && r.rec != null && r.cell !== "none")
    .map((r) => ({ id: r.id, iniciales: r.iniciales, acwr: r.acwr!, rec: r.rec!, cell: r.cell }));
  const noData: NoDataPoint[] = rows.filter((r) => r.cell === "none").map((r) => ({ id: r.id, iniciales: r.iniciales }));

  const onPick = (id: string) => { setPicked(id); navigate(`/coach/a/${id}`); };
  const sel = rows.find((r) => r.id === picked) ?? null;

  return (
    <div style={{ padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>Plantel</div>

      {error ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "16px 0" }}>No se pudo cargar el plantel. Reintentá.</div>
      ) : loading ? (
        <div aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "16px 0" }}>Cargando plantel…</div>
      ) : (
        <>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>{rows.length} atletas · semana en curso</div>
          <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
            <span data-testid="bucket-alert"><Badge tone="alert">{counts.alert} en alerta</Badge></span>
            <span data-testid="bucket-warn"><Badge tone="warn">{counts.warn} a vigilar</Badge></span>
            <span data-testid="bucket-ok"><Badge tone="ok">{counts.ok} ok</Badge></span>
            <span data-testid="bucket-none" style={{ color: STATUS.none, border: `1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)`, fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>
              {counts.none} sin datos
            </span>
          </div>

          <Heatmap rows={rows} weeks={12} onPick={onPick} />
          <RiskQuadrant points={points} noData={noData} onPick={onPick} />

          {sel && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", padding: "8px 0 0" }}>
              {sel.cell === "none" ? (
                <><b style={{ color: "var(--wl-text)" }}>{sel.nombre}</b> · {sel.metodo} · sin datos de monitoreo aún — ver perfil ›</>
              ) : (
                <><b style={{ color: "var(--wl-text)" }}>{sel.nombre}</b> · {sel.metodo} · ACWR {sel.acwr!.toFixed(2)} · recup. {sel.rec}% · <span style={{ color: STATUS[sel.cell] }}>{sel.cell === "alert" ? "alerta" : sel.cell === "warn" ? "vigilar" : "ok"}</span> — ver drill-down ›</>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
