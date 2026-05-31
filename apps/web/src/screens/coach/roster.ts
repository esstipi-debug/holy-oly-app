import type { CellState } from "@holy-oly/core";

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
