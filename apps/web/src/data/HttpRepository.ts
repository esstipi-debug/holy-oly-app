import {
  RosterSchema, MonitorSeriesSchema, MedalsSchema, CompsSchema, PlanSchema, CycleContextSchema,
  type Repository, type Atleta, type MonitorSeries, type Medal, type Competencia, type Plan,
  type CycleShare, type CycleContext,
} from "@holy-oly/core";

/** Fase 1 stub auth header; replaced by real session auth in Fase 3. */
const DEV_COACH = "coach-stub";

interface Parser<T> {
  parse(data: unknown): T;
}

class HttpError extends Error {
  constructor(public readonly status: number, path: string) {
    super(`API ${status} for ${path}`);
    this.name = "HttpError";
  }
}

/**
 * `Repository` implementation backed by the Holy Oly API (Fase 2). Each read validates the
 * response against the shared core Zod schema (never trusts the wire). Writes arrive in Fase 4
 * (the API is read-only in Fase 1); the current UI never calls them.
 */
export class HttpRepository implements Repository {
  constructor(private readonly baseUrl: string) {}

  private async fetchJson(path: string): Promise<{ status: number; ok: boolean; body: unknown }> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: { "x-dev-coach": DEV_COACH } });
    const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    return { status: res.status, ok: res.ok, body };
  }

  private async get<T>(path: string, schema: Parser<T>): Promise<T> {
    const res = await this.fetchJson(path);
    if (!res.ok) throw new HttpError(res.status, path);
    return schema.parse(res.body);
  }

  private async getOptional<T>(path: string, schema: Parser<T>): Promise<T | undefined> {
    const res = await this.fetchJson(path);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new HttpError(res.status, path);
    return schema.parse(res.body);
  }

  private athletePath(id: string, sub: string): string {
    return `/athletes/${encodeURIComponent(id)}/${sub}`;
  }

  async getRoster(): Promise<Atleta[]> {
    return this.get("/roster", RosterSchema);
  }

  async getAthlete(id: string): Promise<Atleta | undefined> {
    return (await this.getRoster()).find((a) => a.id === id);
  }

  async getSeries(id: string): Promise<MonitorSeries | undefined> {
    return this.getOptional(this.athletePath(id, "series"), MonitorSeriesSchema);
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    return this.getOptional(this.athletePath(id, "plan"), PlanSchema);
  }

  async getMedals(id: string): Promise<Medal[]> {
    return this.get(this.athletePath(id, "medals"), MedalsSchema);
  }

  async getComps(id: string): Promise<Competencia[]> {
    return this.get(this.athletePath(id, "comps"), CompsSchema);
  }

  async getCycleContext(id: string): Promise<CycleContext | undefined> {
    return this.getOptional(this.athletePath(id, "cycle"), CycleContextSchema);
  }

  async getCycleShare(id: string): Promise<CycleShare> {
    return (await this.getCycleContext(id))?.share ?? "none";
  }

  // ── Writes arrive in Fase 4 (API is read-only in Fase 1). Unreachable from the current UI. ──
  async savePlan(): Promise<void> {
    throw new Error("HttpRepository.savePlan: writes arrive in Fase 4");
  }
  async addMedal(): Promise<void> {
    throw new Error("HttpRepository.addMedal: writes arrive in Fase 4");
  }
  async setComps(): Promise<void> {
    throw new Error("HttpRepository.setComps: writes arrive in Fase 4");
  }
}
