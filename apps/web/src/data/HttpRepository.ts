import {
  RosterSchema, MonitorSeriesSchema, MedalsSchema, CompsSchema, SessionLogSchema, PlanSchema, CycleContextSchema,
  SessionViewsSchema, WeekHeatsSchema, PrCandidatesSchema, RmUpdatesSchema, AthleteDailyViewSchema, PrilepinWeekSchema,
  MacroHistoryViewSchema, CompetitionListSchema, CompetitionDetailViewSchema, CompetitionSchema, RosterRiskSchema,
  type Repository, type Atleta, type MonitorSeries, type Medal, type Competencia, type Plan,
  type CycleShare, type CycleContext, type SessionLog, type SessionView, type PrescribedExercise, type WeekHeat,
  type PrCandidate, type RmLift, type RmUpdate, type AthleteDailyView, type EngineWeek, type MacroHistoryView,
  type Competition, type CompetitionInput, type CompetitionListItem, type CompetitionDetailView, type CompetitionEntryInput,
  type CoachRisk,
} from "@holy-oly/core";
import { notifyReadOnly } from "../ui/readOnlyNotice";

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

  async getRosterRisk(): Promise<Record<string, CoachRisk>> {
    return this.get("/roster/risk", RosterRiskSchema);
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
  private async send(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    // Consume the body (like fetchJson) so the connection is released and API errors surface.
    const payload = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) {
      const err = payload as { error?: string; code?: string } | undefined;
      // Read-only demo gate blocked the write → tell the UI to flash a friendly "solo lectura" toast.
      if (res.status === 403 && err?.code === "demo_read_only") notifyReadOnly();
      throw new HttpError(res.status, path, err?.error);
    }
    return payload;
  }
  private async mutate(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<void> {
    await this.send(path, method, body);
  }
  private async mutateJson<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown, schema: Parser<T>): Promise<T> {
    return schema.parse(await this.send(path, method, body));
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

  async getSessionLog(id: string): Promise<SessionLog> {
    return this.get(this.athletePath(id, "sessions"), SessionLogSchema);
  }
  async setSessionLog(id: string, log: SessionLog): Promise<void> {
    return this.mutate(this.athletePath(id, "sessions"), "PUT", log);
  }

  async getPrescriptionWeek(id: string, week: number): Promise<SessionView[]> {
    return this.get(`${this.athletePath(id, "prescription")}?week=${week}`, SessionViewsSchema);
  }
  async getPlanHeat(id: string): Promise<WeekHeat[]> {
    return this.get(this.athletePath(id, "heat"), WeekHeatsSchema);
  }
  async getPrilepinWeek(id: string, week: number, lift: RmLift): Promise<EngineWeek | null> {
    return this.get(`${this.athletePath(id, "prilepin-week")}?week=${week}&lift=${lift}`, PrilepinWeekSchema);
  }
  async setSession(id: string, week: number, sessionIdx: number, exercises: PrescribedExercise[]): Promise<void> {
    return this.mutate(`${this.athletePath(id, "prescription")}/${week}/${sessionIdx}`, "PUT", exercises);
  }

  // ── SP5: RMs a mitad de ciclo (coach-only en el server). ──
  async updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    return this.mutate(this.athletePath(id, "rms"), "PUT", { updates, reason });
  }
  async getPrCandidates(id: string): Promise<PrCandidate[]> {
    return this.get(this.athletePath(id, "pr-candidates"), PrCandidatesSchema);
  }
  async getRmHistory(id: string): Promise<RmUpdate[]> {
    return this.get(this.athletePath(id, "rm-history"), RmUpdatesSchema);
  }

  // ── Lazo diario (coach-only en el server): check-ins + adherencia reconciliada. ──
  async getDaily(id: string): Promise<AthleteDailyView> {
    return this.get(this.athletePath(id, "daily"), AthleteDailyViewSchema);
  }

  // ── Historial de macrociclos cerrados (slice macro-history): coach-visible. ──
  async getMacroHistory(id: string): Promise<MacroHistoryView> {
    return this.get(this.athletePath(id, "macro-history"), MacroHistoryViewSchema);
  }

  // ── Competencias compartidas del coach (slice 2026-06-14). ──
  async getCompetitions(): Promise<CompetitionListItem[]> {
    return this.get("/competitions", CompetitionListSchema);
  }
  async getCompetition(id: string): Promise<CompetitionDetailView | undefined> {
    return this.getOptional(`/competitions/${encodeURIComponent(id)}`, CompetitionDetailViewSchema);
  }
  async createCompetition(input: CompetitionInput): Promise<Competition> {
    return this.mutateJson("/competitions", "POST", input, CompetitionSchema);
  }
  async updateCompetition(id: string, input: CompetitionInput): Promise<void> {
    return this.mutate(`/competitions/${encodeURIComponent(id)}`, "PATCH", input);
  }
  async deleteCompetition(id: string): Promise<void> {
    return this.mutate(`/competitions/${encodeURIComponent(id)}`, "DELETE");
  }
  async acoplarAtletas(id: string, entries: CompetitionEntryInput[]): Promise<void> {
    return this.mutate(`/competitions/${encodeURIComponent(id)}/entries`, "POST", { entries });
  }
  async desacoplarAtleta(id: string, athleteId: string): Promise<void> {
    return this.mutate(`/competitions/${encodeURIComponent(id)}/entries/${encodeURIComponent(athleteId)}`, "DELETE");
  }
}
