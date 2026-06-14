import { acwr, rosterStatus, seriesState, readiness, readinessTrend, type CellState, type Repository } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";

export interface RosterRow {
  id: string;
  nombre: string;
  iniciales: string;
  metodo: string;
  compite: boolean;
  acwr: number | undefined;
  rec: number | undefined;
  cell: CellState;
  readiness: number | undefined;
  trend: number | undefined;
  cat: string | undefined;
  history: CellState[];
  /** Alerta del coach (slice macro-history): el atleta no tiene RM cargado → no se puede prescribir. */
  needsRm: boolean;
}

export async function getRosterRows(repo: Repository): Promise<RosterRow[]> {
  const roster = await repo.getRoster();
  const seriesList = await Promise.all(roster.map((a) => repo.getSeries(a.id)));
  return roster.map((a, i) => {
    const s = seriesList[i];
    const weeks = s?.weeks ?? 0;
    const lastAcwr = s ? acwr(s.acute).at(-1) : undefined;
    const acwrV = lastAcwr != null && Number.isFinite(lastAcwr) ? lastAcwr : undefined;
    const rec = s ? s.recovery.at(-1) : undefined;
    return {
      id: a.id,
      nombre: a.nombre,
      iniciales: a.iniciales,
      metodo: ROSTER_META[a.id]?.metodo ?? "",
      compite: !!a.compite,
      acwr: acwrV,
      rec,
      cell: rosterStatus(s),
      readiness: readiness(rec, acwrV),
      trend: readinessTrend(s),
      cat: s?.weightBand ? `${s.weightBand[1]} kg` : undefined,
      history: Array.from({ length: weeks }, (_, w) => seriesState(s, w + 1)),
      needsRm: a.needsRm === true,
    };
  });
}
