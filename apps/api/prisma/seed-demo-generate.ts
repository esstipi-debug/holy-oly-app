/**
 * Procedural demo expansion: extra gyms, athletes, and long monitor histories (up to 500 weeks).
 */
import { MACROCYCLES, recoverySeries, type MacrocycleLevel, type MonitorSeries } from "@holy-oly/core";

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

export const MACRO_IDS = MACROCYCLES.map((m) => m.id);

/** Week depths rotated across the expanded roster (max 500). */
export const WEEK_DEPTHS = [52, 104, 156, 208, 260, 312, 364, 416, 468, 500] as const;

export interface ExtraGymDef {
  key: string;
  name: string;
  email: string;
  password: string;
  inviteCode: string;
  athleteCount: number;
}

/** Six additional gyms (coach3–coach8). Passwords match the dev demo default. */
export const EXTRA_GYMS: ExtraGymDef[] = [
  { key: "g3", name: "Cross Norte", email: "gym3@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER456701", athleteCount: 14 },
  { key: "g4", name: "Halters Sur", email: "gym4@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER567812", athleteCount: 14 },
  { key: "g5", name: "Oly Centro", email: "gym5@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER678923", athleteCount: 14 },
  { key: "g6", name: "Fuerza Oeste", email: "gym6@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER789034", athleteCount: 14 },
  { key: "g7", name: "Club Pesas Este", email: "gym7@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER890145", athleteCount: 14 },
  { key: "g8", name: "Academia Lifter", email: "gym8@holyoly.dev", password: "holyoly-demo", inviteCode: "HALTER901256", athleteCount: 14 },
];

const FIRST_NAMES_M = ["Mateo", "Julián", "Nico", "Facundo", "Agustín", "Emilio", "Santi", "Tomás", "Benja", "Lucas", "Franco", "Iván", "Marcos", "Leo"];
const FIRST_NAMES_F = ["Valentina", "Camila", "Julieta", "Martina", "Sofía", "Lucía", "Emilia", "Agustina", "Catalina", "Florencia", "Bianca", "Micaela", "Paula", "Renata"];
const LAST_INITIALS = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "I.", "J.", "K.", "L.", "M.", "N.", "O.", "P.", "R.", "S.", "T.", "V."];

export interface GeneratedAthlete {
  id: string;
  nombre: string;
  iniciales: string;
  nivel: MacrocycleLevel;
  sexo: "M" | "F";
  compite: boolean;
  macroId: string;
  weekCount: number;
  weightBandLo?: number;
  weightBandHi?: number;
  gymKey: string;
}

function withRec(b: Omit<MonitorSeries, "recovery">): MonitorSeries {
  return { ...b, recovery: recoverySeries({ ...b, recovery: [] }) };
}

/**
 * Deterministic long-range telemetry. `seed` steers personality (alert / steady / volatile / build / deload).
 */
export function generateLongSeries(weekCount: number, seed: number): MonitorSeries {
  const mk = (f: (i: number) => number): number[] => Array.from({ length: weekCount }, (_, i) => f(i));
  const mesoLen = 13;
  const meso = (i: number): number => i % mesoLen;
  const yearBlock = (i: number): number => Math.floor(i / 52);
  const personality = seed % 5;
  const hard = (i: number): boolean => {
    if (personality === 0) return meso(i) >= 7 && meso(i) <= 10;
    if (personality === 1) return false;
    if (personality === 2) return meso(i) === 10 || (i % 17 === 16);
    if (personality === 3) return meso(i) >= 9;
    return meso(i) >= 6 && meso(i) <= 9;
  };
  const wave = (i: number): number => Math.cos((i + seed * 0.61) / 3.4);
  const macroDrift = (i: number): number => yearBlock(i) * 18;

  const acute = mk((i) => {
    const mesoLoad = meso(i) < 11 ? meso(i) * 11 : -22;
    const spike = hard(i) ? 35 + (personality === 2 ? 80 : 0) : 0;
    return clampInt(270 + macroDrift(i) + i * 0.85 + mesoLoad + spike + 8 * wave(i), 210, 880);
  });
  const hrvBase = clampInt(70 + (seed % 4), 66, 74);
  const hrv = mk((i) => clampInt(hrvBase - (hard(i) ? 6 + personality : 0) + 2.5 * wave(i), 54, 82));
  const rhrBase = clampInt(50 + (seed % 3), 47, 54);
  const rhr = mk((i) => clampInt(rhrBase + (hard(i) ? 5 : 0) - 2 * wave(i), 44, 62));
  const imr = mk((i) => clampInt(62 + macroDrift(i) * 0.4 + meso(i) * 1.8 + i / 14, 58, 98));
  const wellness = mk((i) => clampInt(80 - (hard(i) ? 12 : 0) + 4 * wave(i) - personality, 48, 94));
  const compliance = mk((i) => clampInt(93 - (hard(i) ? 8 : 0) + (meso(i) < 2 ? 3 : 0), 65, 100));
  const bodyweight = mk((i) => Math.round((78 + (seed % 9) + 0.35 * Math.sin(i / 5.5) + yearBlock(i) * 0.2) * 10) / 10);
  const bandLo = 75 + (seed % 6);
  const item = (base: number, amp: number, invert = false): number[] =>
    mk((i) => clampInt(base + (hard(i) ? (invert ? -amp : amp) : 0) + (invert ? -1 : 1) * wave(i), 1, 5));

  return withRec({
    weeks: weekCount,
    acute,
    hrv,
    hrvBase,
    rhr,
    rhrBase,
    imr,
    wellness,
    compliance,
    bodyweight,
    weightBand: [bandLo, bandLo + 2],
    wellnessItems: {
      Fatiga: item(2, 2),
      Dolor: item(2, 1),
      Estrés: item(2, 1),
      Humor: item(4, 2, true),
      Motivación: item(4, 1, true),
      Sueño: item(4, 2, true),
    },
  });
}

export function buildExtraAthletes(): GeneratedAthlete[] {
  const out: GeneratedAthlete[] = [];
  for (const gym of EXTRA_GYMS) {
    for (let i = 0; i < gym.athleteCount; i++) {
      const globalIdx = out.length;
      const female = i % 2 === 1;
      const first = female ? FIRST_NAMES_F[i % FIRST_NAMES_F.length]! : FIRST_NAMES_M[i % FIRST_NAMES_M.length]!;
      const last = LAST_INITIALS[(globalIdx + i) % LAST_INITIALS.length]!;
      const macro = MACROCYCLES[(globalIdx + i * 3) % MACROCYCLES.length]!;
      const weekCount = WEEK_DEPTHS[(globalIdx + i) % WEEK_DEPTHS.length]!;
      const id = `${gym.key}a${String(i + 1).padStart(2, "0")}`;
      const iniciales = `${first[0]}${last[0]}`.toUpperCase();
      out.push({
        id,
        nombre: `${first} ${last}`,
        iniciales,
        nivel: macro.level,
        sexo: female ? "F" : "M",
        compite: i % 3 !== 2,
        macroId: macro.id,
        weekCount,
        weightBandLo: female ? 58 + (i % 5) : 75 + (i % 8),
        weightBandHi: female ? 60 + (i % 5) : 78 + (i % 8),
        gymKey: gym.key,
      });
    }
  }
  return out;
}
