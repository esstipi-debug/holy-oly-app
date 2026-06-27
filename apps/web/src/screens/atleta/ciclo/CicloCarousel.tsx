import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation, Trans } from "react-i18next";
import type { MeCycleView } from "@holy-oly/core";
import type { MeClient } from "../../../data/meClient";
import { buildCycleView } from "./cycleView";
import { CycleTimeline } from "./CycleTimeline";
import { CycleRing } from "./CycleRing";
import { CyclePhaseCard } from "./CyclePhaseCard";

const head: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 };
const title: CSSProperties = { fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, color: "var(--wl-text)" };
const sub: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" };
const card: CSSProperties = { background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "14px 14px 10px" };
const muted: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" };
const empty: CSSProperties = { ...muted, background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "14px", lineHeight: 1.5 };
const nav: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 };
const arrow: CSSProperties = { border: 0, background: "transparent", color: "var(--wl-text)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "0 4px" };
const dots: CSSProperties = { display: "flex", gap: 6, alignItems: "center" };
const dot: CSSProperties = { width: 7, height: 7, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer" };
const fmtName: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", minWidth: 92, textAlign: "center" };

/**
 * «Tu ciclo» — la vista GRAFICADA del ciclo menstrual de la atleta (lo que pidió el owner): un
 * carrusel de 3 formatos del mismo ciclo (línea de tiempo · anillo · tarjeta). Carga su propio
 * registro (`getMeCycle`) y proyecta con `buildCycleView` (sólo si es regular + con fecha; si no,
 * mensaje honesto). Paleta NEUTRA, jamás semáforo; es contexto, nunca una alerta ni un logro.
 */
export function CicloCarousel({ client, today = new Date().toISOString().slice(0, 10), hideWhenEmpty = false }: { client: MeClient; today?: string; hideWhenEmpty?: boolean }) {
  const { t } = useTranslation(["atleta", "common"]);
  const FORMATS = [t("ccarFormatTimeline"), t("ccarFormatRing"), t("ccarFormatCard")] as const;
  const [cycle, setCycle] = useState<MeCycleView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let on = true;
    client.getMeCycle().then(
      (c) => { if (on) { setCycle(c); setLoaded(true); } },
      () => { if (on) setLoaded(true); },
    );
    return () => { on = false; };
  }, [client]);

  // hideWhenEmpty (Home): mientras carga o si no hay ciclo proyectable, no rendira nada — el opt-in
  // vive en Cuenta y no se naggea en la portada. En «Detalle del plan» (sin el flag) sí avisa.
  if (!loaded) return hideWhenEmpty ? null : <div role="status" style={{ ...muted, marginTop: 16 }}>{t("common:loading")}</div>;
  // Female-only (owner 2026-06-14): un hombre nunca ve «Tu ciclo». Error de carga (cycle=null) → tampoco.
  if (cycle?.sexo !== "F") return null;

  const view = cycle ? buildCycleView(cycle, today) : null;
  if (view == null && hideWhenEmpty) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={head}>
        <span style={title}>{t("ccarTitle")}</span>
        <span style={sub}>{t("ccarSubtitle")}</span>
      </div>
      {view == null ? (
        <div style={empty}>
          <Trans t={t} i18nKey="ccarEmpty" components={{ b: <b style={{ color: "var(--wl-text)" }} /> }} />
        </div>
      ) : (
        <div style={card}>
          {idx === 0 && <CycleTimeline view={view} />}
          {idx === 1 && <CycleRing view={view} />}
          {idx === 2 && <CyclePhaseCard view={view} />}
          <div style={nav}>
            <button type="button" aria-label={t("ccarFormatPrev")} onClick={() => setIdx((i) => (i + FORMATS.length - 1) % FORMATS.length)} style={arrow}>‹</button>
            <div style={dots}>
              {FORMATS.map((f, i) => (
                <button key={f} type="button" aria-label={t("ccarFormatView", { format: f })} aria-current={i === idx}
                  onClick={() => setIdx(i)}
                  style={{ ...dot, background: i === idx ? "var(--wl-text)" : "color-mix(in srgb, var(--wl-text) 24%, transparent)" }} />
              ))}
            </div>
            <span style={fmtName}>{FORMATS[idx]}</span>
            <button type="button" aria-label={t("ccarFormatNext")} onClick={() => setIdx((i) => (i + 1) % FORMATS.length)} style={arrow}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
