import { useState, type CSSProperties, type ReactNode } from "react";
import { DiscRow } from "../../../../ui/Disc";
import { Confetti } from "./Confetti";
import { Radar, type RadarData } from "./Radar";
import type { CelebrationTier } from "./gamify";
import "./celebracion.css";

export interface CelLift { nm: string; top: number; sets: number; reps: number; pct?: number }
export interface CelStat { v: string; l: string }
export interface CelData {
  tiers: CelebrationTier[];      // logradas, en orden: ["dia"] | ["dia","semana"] | ["dia","semana","macro"]
  barKg: number;
  radar: RadarData | null;
  streakWeeks: number;
  // XP / nivel (acumulado, derivado del recorrido)
  level: number; nextLevel: number; xpToNext: number; xpFromPct: number; xpToPct: number; tag: string;
  // día
  diaMeta: string; lifts: CelLift[]; diaXp: number; diaTotalKg: number; diaSets: number;
  // semana
  week: number; weekMeta: string; weekStats: CelStat[]; weekXp: number;
  // macro
  macroName: string; macroMeta: string; macroStats: CelStat[]; phases: string[]; macroXp: number;
  onClaim: () => void;
}

const CheckIcon = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);
const MiniCheck = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
);
const ABBR: Record<string, string> = { "Sentadilla trasera": "Sentadilla", "Sentadilla frontal": "Front" };
const abbr = (nm: string): string => ABBR[nm] ?? nm;
const CL = (n: number): string => n.toLocaleString("es-CL");

function Hex({ x, y, w, cls = "", children }: { x: number; y: number; w: number; cls?: string; children: ReactNode }) {
  const h = Math.round(w * 0.866);
  return (
    <div className={"hex " + cls} style={{ left: x, top: y, width: w, height: h }}>
      <div className="hex__ring" /><div className="hex__bg" />
      <div className="hex__in">{children}</div>
    </div>
  );
}

function XPBlock({ level, nextLevel, xpToNext, pts, fromPct, toPct, tag }: {
  level: number; nextLevel: number; xpToNext: number; pts: string; fromPct: number; toPct: number; tag: string;
}) {
  return (
    <div className="cel-xp">
      <div className="cel-xp__top">
        <span className="cel-xp__lvl">Nivel <b>{level}</b> · {tag}</span>
        <span className="cel-xp__pts">{pts}</span>
      </div>
      <div className="cel-xp__track"><div className="cel-xp__fill" style={{ ["--xp-from" as string]: `${fromPct}%`, ["--xp-to" as string]: `${toPct}%` } as CSSProperties} /></div>
      <div className="cel-xp__next">{xpToNext} XP para Nivel {nextLevel}</div>
    </div>
  );
}

const Streak = ({ weeks }: { weeks: number }) => (
  <div className="cel-streak">
    <span className="cel-streak__flame" aria-hidden>🔥</span>
    <b>{weeks}</b><span>semana{weeks === 1 ? "" : "s"} de racha · el descanso no la rompe</span>
  </div>
);

function RadarHex({ radar }: { radar: RadarData | null }) {
  return (
    <Hex x={46} y={0} w={224} cls="hex--radar">
      {radar
        ? <Radar size={180} data={radar} />
        : <div className="cel-radar__empty">Registrá tu día a día y acá vas a ver tu bienestar de hoy vs tu promedio.</div>}
    </Hex>
  );
}

const RadarLegend = ({ extra }: { extra?: string }) => (
  <div className="cel-legend">
    <span className="cel-legend__i"><span className="cel-legend__sw cel-legend__sw--today" />Hoy</span>
    <span className="cel-legend__i"><span className="cel-legend__sw cel-legend__sw--avg" />Promedio</span>
    {extra && <span className="cel-legend__i" style={{ color: "var(--wl-accent)", fontWeight: 700 }}>{extra}</span>}
  </div>
);

const POS3 = [{ x: 6, y: 205 }, { x: 102, y: 253 }, { x: 198, y: 205 }];

function CelDia({ d }: { d: CelData }) {
  const lifts = d.lifts.slice(0, 3);
  return (
    <>
      <Confetti count={50} />
      <div className="cel-head">
        <div className="cel-check">{CheckIcon}</div>
        <div className="cel-kicker">Objetivo del día ✓</div>
        <div className="cel-title">¡Entreno guardado!</div>
        <div className="cel-meta">{d.diaMeta}</div>
      </div>
      {d.streakWeeks > 0 && <Streak weeks={d.streakWeeks} />}
      <div className="cel-panal">
        <RadarHex radar={d.radar} />
        {lifts.map((l, i) => (
          <Hex key={i} x={POS3[i]!.x} y={POS3[i]!.y} w={112} cls="hex--mov">
            <span className="hex-mov__nm">{abbr(l.nm)}</span>
            <span className="hex-mov__kg">{l.top}<i>kg</i></span>
            <div className="hex-mov__scheme"><span className="hex-mov__sets">{l.sets}×{l.reps}</span>{l.pct != null && <span className="hex-mov__pct">{l.pct}%</span>}</div>
            <div className="hex-mov__discs"><DiscRow kg={l.top} barKg={d.barKg} size={14} /></div>
          </Hex>
        ))}
      </div>
      {d.radar && <RadarLegend extra={`${CL(d.diaTotalKg)} kg · ${d.diaSets} series`} />}
      <XPBlock level={d.level} nextLevel={d.nextLevel} xpToNext={d.xpToNext} pts={`+${d.diaXp} XP`} fromPct={d.xpFromPct} toPct={d.xpToPct} tag={d.tag} />
      {/* resumen del entreno (pedido owner 2026-06-11: cada ejercicio visible) */}
      <div className="cel-resumen-wrap">
        <div className="cel-resumen__head"><span className="cel-resumen__title">Resumen del entreno</span><span className="cel-resumen__total">{CL(d.diaTotalKg)} kg · {d.diaSets} series</span></div>
        <div className="cel-resumen">
          {d.lifts.map((l, i) => (
            <div className="cel-resumen__row" key={i}>
              <span className="cel-resumen__chk" aria-hidden>{MiniCheck}</span>
              <div className="cel-resumen__body">
                <div className="cel-resumen__l1"><span className="cel-resumen__nm">{l.nm}</span><span className="cel-resumen__kg">{l.top}<i>kg</i></span></div>
                <div className="cel-resumen__l2">
                  <span className="cel-resumen__sets">{l.sets} × {l.reps}</span>
                  {l.pct != null && <span className="cel-resumen__pct">{l.pct}%</span>}
                  <span className="cel-resumen__discs"><DiscRow kg={l.top} barKg={d.barKg} size={18} /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="cel-cta" onClick={d.onClaim}>Reclamar</button>
    </>
  );
}

function CelSemana({ d }: { d: CelData }) {
  return (
    <>
      <Confetti count={54} />
      <div className="cel-head">
        <div className="cel-check">{CheckIcon}</div>
        <div className="cel-kicker">Semana {d.week} completa</div>
        <div className="cel-title">¡Semana cerrada!</div>
        <div className="cel-meta">{d.weekMeta}</div>
      </div>
      {d.streakWeeks > 0 && <Streak weeks={d.streakWeeks} />}
      <div className="cel-panal">
        <RadarHex radar={d.radar} />
        {d.weekStats.slice(0, 3).map((st, i) => (
          <Hex key={i} x={POS3[i]!.x} y={POS3[i]!.y} w={112} cls="hex--stat">
            <span className="hex-stat__v">{st.v}</span><span className="hex-stat__l">{st.l}</span>
          </Hex>
        ))}
      </div>
      {d.radar && <RadarLegend extra="bienestar de la semana" />}
      <XPBlock level={d.level} nextLevel={d.nextLevel} xpToNext={d.xpToNext} pts={`+${d.weekXp} XP`} fromPct={d.xpFromPct} toPct={d.xpToPct} tag={d.tag} />
      <button type="button" className="cel-cta" onClick={d.onClaim}>Seguir</button>
    </>
  );
}

const FLOWER = [
  { x: 108, y: 21 }, { x: 183, y: 64 }, { x: 183, y: 151 }, { x: 108, y: 195 }, { x: 33, y: 151 }, { x: 33, y: 64 },
];

function CelMacro({ d }: { d: CelData }) {
  return (
    <>
      <Confetti count={68} />
      <div className="cel-head">
        <div className="cel-check">{CheckIcon}</div>
        <div className="cel-kicker">Macrociclo completo</div>
        <div className="cel-title">¡{d.macroName}<br />terminado!</div>
        <div className="cel-meta">{d.macroMeta}</div>
      </div>
      {d.phases.length > 0 && (
        <div className="cel-phases">
          {d.phases.map((p, i) => <span className="cel-phase" key={i}><span className="cel-phase__nm">{p}</span><span className="cel-phase__ck" aria-hidden>✓</span></span>)}
        </div>
      )}
      <div className="cel-flower">
        <Hex x={108} y={108} w={100} cls="hex--trophy">
          <span className="hex-trophy__ic" aria-hidden>🏆</span>
          <span className="hex-trophy__t">Macro<br />completo</span>
        </Hex>
        {d.macroStats.slice(0, 6).map((st, i) => (
          <Hex key={i} x={FLOWER[i]!.x} y={FLOWER[i]!.y} w={100} cls="hex--stat">
            <span className="hex-stat__v">{st.v}</span><span className="hex-stat__l">{st.l}</span>
          </Hex>
        ))}
      </div>
      <XPBlock level={d.level} nextLevel={d.nextLevel} xpToNext={d.xpToNext} pts={`+${d.macroXp} XP`} fromPct={d.xpFromPct} toPct={d.xpToPct} tag={d.tag} />
      <button type="button" className="cel-cta" onClick={d.onClaim}>Listo</button>
    </>
  );
}

const TAB_SUB: Record<CelebrationTier, string> = { dia: "entreno", semana: "semana", macro: "macro" };
const TAB_LABEL: Record<CelebrationTier, string> = { dia: "Día", semana: "Semana", macro: "Macro" };

/** Celebración post-sesión (rediseño 0110). Muestra la celebración de mayor alcance lograda
 *  (Día/Semana/Macro) con un rotador para revisitarlas — sólo aparecen las realmente logradas. */
export function Celebracion({ data }: { data: CelData }) {
  const [view, setView] = useState<CelebrationTier>(() => data.tiers[data.tiers.length - 1] ?? "dia");
  const tier = data.tiers.includes(view) ? view : "dia";
  return (
    <div className="cel-root">
      {data.tiers.length > 1 && (
        <div className="cel-rotator" role="tablist" aria-label="Celebraciones logradas">
          {data.tiers.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tier} className={"cel-rotator__tab" + (t === tier ? " on" : "")} onClick={() => setView(t)}>
              {TAB_LABEL[t]}<small>{TAB_SUB[t]}</small>
            </button>
          ))}
        </div>
      )}
      {tier === "macro" ? <CelMacro d={data} /> : tier === "semana" ? <CelSemana d={data} /> : <CelDia d={data} />}
    </div>
  );
}
