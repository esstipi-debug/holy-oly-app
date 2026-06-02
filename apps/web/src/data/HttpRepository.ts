import {
  RosterSchema, MonitorSeriesSchema, MedalsSchema, CompsSchema, PlanSchema, CycleContextSchema,
  type Repository, type Atleta, type MonitorSeries, type Medal, type Competencia, type Plan,
  type CycleShare, type CycleContext, type SessionLog,
} from "@holy-oly/core";

interface Parser<T> {
  parse(data: unknown): T;
}

class HttpError extends Error {
  constructor(public readonly status: number, path: string, detail?: string) {
    super(`API ${status} for ${path}${detail ? `: ${detail}` : ""}`);
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
    // The httpOnly session cookie (Fase 3) travels with the request; the API resolves the coach from it.
    const res = await fetch(`${this.baseUrl}${path}`, { credentials: "include" });
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

  // ── Writes (Fase 4). Coach-authorized; the httpOnly session cookie carries the principal. ──
  private async mutate(path: string, method: "POST" | "PUT", body: unknown): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // Consume the body (like fetchJson) so the connection is released and API errors surface.
    const payload = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
    if (!res.ok) throw new HttpError(res.status, path, payload?.error);
  }

  // The interface gives no separate id; the path athlete is plan.atletaId (server enforces the match).
  async savePlan(plan: Plan): Promise<void> {
    return this.mutate(this.athletePath(plan.atletaId, "plan"), "PUT", plan);
  }
  async addMedal(id: string, medal: Medal): Promise<void> {
    return this.mutate(this.athletePath(id, "medals"), "POST", medal);
  }
  async setComps(id: string, comps: Competencia[]): Promise<void> {
    return this.mutate(this.athletePath(id, "comps"), "PUT", comps);
  }

  // Session adherence persistence lands with the athlete-app API (its endpoint + table). Until
  // then HttpRepository can't serve it: reads are empty, a write surfaces a clear error.
  async getSessionLog(): Promise<SessionLog> {
    return [];
  }
  async setSessionLog(): Promise<void> {
    throw new HttpError(501, "/sessions", "el registro de sesiones llega con la app del atleta");
  }
}
