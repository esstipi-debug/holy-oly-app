import { describe, it, expect } from "vitest";
import { buildAdminOverview, type UserRow, type CoachRow, type AthleteWithLinks } from "./overview";

function athlete(id: string, opts: Partial<AthleteWithLinks> = {}): AthleteWithLinks {
  return {
    id,
    nombre: `Atleta ${id}`,
    nivel: "beginner",
    compite: false,
    user: { email: `${id}@x.com`, signupCountry: "AR", emailVerified: true },
    vinculos: [{ id: `v-${id}` }],
    ...opts,
  };
}

describe("buildAdminOverview", () => {
  it("groups athletes under their coach with country + email", () => {
    const a1 = athlete("a1");
    const coaches: CoachRow[] = [
      {
        id: "c1",
        name: "Coach Uno",
        user: { email: "coach@x.com", signupCountry: "CL" },
        vinculos: [{ athlete: a1 }],
      },
    ];
    const out = buildAdminOverview([], coaches, [a1]);

    expect(out.coaches).toHaveLength(1);
    const c0 = out.coaches[0]!;
    expect(c0).toMatchObject({ name: "Coach Uno", email: "coach@x.com", country: "CL", athleteCount: 1 });
    expect(c0.athletes[0]).toMatchObject({ id: "a1", country: "AR", email: "a1@x.com", emailVerified: true });
  });

  it("lists athletes with no active vínculo as unlinked", () => {
    const linked = athlete("a1");
    const orphan = athlete("a2", { vinculos: [] });
    const coaches: CoachRow[] = [
      { id: "c1", name: "C", user: { email: "c@x.com", signupCountry: null }, vinculos: [{ athlete: linked }] },
    ];
    const out = buildAdminOverview([], coaches, [linked, orphan]);

    expect(out.unlinkedAthletes.map((a) => a.id)).toEqual(["a2"]);
    expect(out.totals).toEqual({ users: 0, coaches: 1, athletes: 2, linkedAthletes: 1 });
  });

  it("surfaces country as a per-user field and serializes createdAt to ISO", () => {
    const users: UserRow[] = [
      { id: "u1", email: "u1@x.com", role: "coach", signupCountry: "AR", emailVerified: true, createdAt: new Date("2026-01-02T03:04:05.000Z") },
      { id: "u2", email: "u2@x.com", role: "atleta", signupCountry: null, emailVerified: false, createdAt: new Date("2026-02-01T00:00:00.000Z") },
    ];
    const out = buildAdminOverview(users, [], []);

    expect(out.users[0]).toMatchObject({ email: "u1@x.com", role: "coach", country: "AR", createdAt: "2026-01-02T03:04:05.000Z" });
    expect(out.users[1]!.country).toBeNull();
    expect(out.totals.users).toBe(2);
  });

  it("marks athletes without a user account (no login) with null emailVerified", () => {
    const seed = athlete("s1", { user: null, vinculos: [] });
    const out = buildAdminOverview([], [], [seed]);
    expect(out.unlinkedAthletes[0]).toMatchObject({ id: "s1", email: null, country: null, emailVerified: null });
  });
});
