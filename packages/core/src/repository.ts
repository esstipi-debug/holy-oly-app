import type { Atleta, Plan, Medal, Competencia, MonitorSeries } from "./types";

export interface Repository {
  getRoster(): Promise<Atleta[]>;
  getAthlete(id: string): Promise<Atleta | undefined>;
  getSeries(id: string): Promise<MonitorSeries>;
  getPlan(id: string): Promise<Plan | undefined>;
  savePlan(plan: Plan): Promise<void>;
  getMedals(id: string): Promise<Medal[]>;
  addMedal(id: string, medal: Medal): Promise<void>;
  getComps(id: string): Promise<Competencia[]>;
  setComps(id: string, comps: Competencia[]): Promise<void>;
}
