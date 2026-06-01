import { acwr, rosterStatus, seriesState, type CellState, type Repository } from "@holy-oly/core";
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
  history: CellState[];
}

export async function getRosterRows(repo: Repository): Promise<RosterRow[]> {
  const roster = await repo.getRoster();
  const seriesList = await Promise.all(roster.map((a) => repo.getSeries(a.id)));
  return roster.map((a, i) => {
    const s = seriesList[i];
    const weeks = s?.weeks ?? 0;
    const lastAcwr = s ? acwr(s.acute).at(-1) : undefined;
    return {
      id: a.id,
      nombre: a.nombre,
      iniciales: a.iniciales,
      metodo: ROSTER_META[a.id]?.metodo ?? "",
      compite: !!a.compite,
      acwr: lastAcwr != null && Number.isFinite(lastAcwr) ? lastAcwr : undefined,
      rec: s ? s.recovery.at(-1) : undefined,
      cell: rosterStatus(s),
      history: Array.from({ length: weeks }, (_, w) => seriesState(s, w + 1)),
    };
  });
}
