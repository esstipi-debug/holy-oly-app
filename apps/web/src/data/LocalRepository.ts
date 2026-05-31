import type {
  Repository, Atleta, Plan, Medal, Competencia, MonitorSeries,
  CycleShare, CycleState, CycleContext,
} from "@holy-oly/core";
import { JsonStore } from "./storage";
import { KEYS } from "./keys";
import { SEED_ROSTER, SEED_SERIES, SEED_CYCLE } from "./seeds";

export class LocalRepository implements Repository {
  private s: JsonStore;
  constructor(backend: Storage = localStorage) { this.s = new JsonStore(backend); }

  /** Idempotent: seeds once, guarded by ho:seeded so refresh keeps edits. */
  init(): void {
    if (this.s.has(KEYS.seeded)) return;
    this.s.set(KEYS.roster, SEED_ROSTER);
    for (const a of SEED_ROSTER) {
      const series = SEED_SERIES[a.id];
      if (series) this.s.set(KEYS.series(a.id), series);
      const cyc = SEED_CYCLE[a.id] ?? { share: "min" as CycleShare, state: "regular" as CycleState };
      this.s.set(KEYS.cycleShare(a.id), cyc.share);
      this.s.set(KEYS.cycleState(a.id), cyc.state);
    }
    this.s.set(KEYS.seeded, true);
  }

  async getRoster(): Promise<Atleta[]> { return this.s.get<Atleta[]>(KEYS.roster, []); }
  async getAthlete(id: string): Promise<Atleta | undefined> {
    return (await this.getRoster()).find((a) => a.id === id);
  }
  async getSeries(id: string): Promise<MonitorSeries | undefined> {
    return this.s.getOptional<MonitorSeries>(KEYS.series(id));
  }
  async getPlan(id: string): Promise<Plan | undefined> {
    return this.s.getOptional<Plan>(KEYS.plan(id));
  }
  async savePlan(plan: Plan): Promise<void> { this.s.set(KEYS.plan(plan.atletaId), plan); }
  async getMedals(id: string): Promise<Medal[]> { return this.s.get<Medal[]>(KEYS.medals(id), []); }
  async addMedal(id: string, medal: Medal): Promise<void> {
    this.s.set(KEYS.medals(id), [...(await this.getMedals(id)), medal]);
  }
  async getComps(id: string): Promise<Competencia[]> { return this.s.get<Competencia[]>(KEYS.comps(id), []); }
  async setComps(id: string, comps: Competencia[]): Promise<void> { this.s.set(KEYS.comps(id), comps); }

  async getCycleShare(id: string): Promise<CycleShare> {
    return this.s.get<CycleShare>(KEYS.cycleShare(id), "none");
  }
  /** Redaction by construction: never exposes phase/day/symptom. */
  async getCycleContext(id: string): Promise<CycleContext | undefined> {
    const share = await this.getCycleShare(id);
    if (share === "none") return undefined;
    const state = this.s.get<CycleState>(KEYS.cycleState(id), "regular");
    const reliable = state === "regular";
    const health: CycleContext["health"] = state === "amenorrhea" ? "referral" : "ok";
    // "min" share never reveals the luteal flag; "full" could (placeholder false until the athlete slice computes it).
    const inLutealNow = share === "full" ? false : null;
    return { share, inLutealNow, health, reliable };
  }

  /** Test-only cycle writer (no coach-facing cycle setter exists by design). */
  __setCycleForTest(id: string, share: CycleShare, state: CycleState): void {
    this.s.set(KEYS.cycleShare(id), share);
    this.s.set(KEYS.cycleState(id), state);
  }
}
