import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db/client";
import { getCycle, getMyCycle, putMyCycle } from "./repo";
import { encryptAtRest } from "./crypto-at-rest";

// D1: with a key set, cycle share/state are AES-256-GCM at rest; the read path decrypts so the
// coach-facing redaction is unchanged. Uses a throwaway athlete so seeded rows are untouched.
describe("cycle encryption at rest (D1)", () => {
  const prev = process.env.CYCLE_ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.CYCLE_ENCRYPTION_KEY = "b".repeat(64);
  });
  afterAll(async () => {
    if (prev === undefined) delete process.env.CYCLE_ENCRYPTION_KEY;
    else process.env.CYCLE_ENCRYPTION_KEY = prev;
    await prisma.$disconnect();
  });

  it("stores ciphertext at rest but reads back the correct redacted context", async () => {
    const id = `enc-${Date.now()}`;
    await prisma.athlete.create({ data: { id, nombre: "Enc T", iniciales: "ET", nivel: "beginner" } });
    try {
      await prisma.cycleConsent.create({
        data: { athleteId: id, share: encryptAtRest("full"), state: encryptAtRest("amenorrhea") },
      });
      const raw = await prisma.cycleConsent.findUnique({ where: { athleteId: id } });
      expect(raw?.state).not.toBe("amenorrhea"); // not plaintext at rest
      expect(raw?.state.startsWith("enc:")).toBe(true);
      expect(raw?.share.startsWith("enc:")).toBe(true);
      // read path decrypts → redaction reflects the real state (amenorrhea → referral).
      // inLutealNow: null — sin datos de período no se computa (y amenorrea no proyecta jamás).
      expect(await getCycle(prisma, id, "2026-06-10")).toEqual({
        share: "full",
        inLutealNow: null,
        health: "referral",
        reliable: false,
      });
    } finally {
      await prisma.athlete.delete({ where: { id } }); // cascades the cycleConsent row
    }
  });

  it("putMyCycle cifra TODOS los campos (incl. fecha/duración del ciclo) y getMyCycle los descifra", async () => {
    const id = `enc2-${Date.now()}`;
    await prisma.athlete.create({ data: { id, nombre: "Enc T2", iniciales: "E2", nivel: "beginner" } });
    try {
      await putMyCycle(prisma, id, { share: "full", state: "regular", lastPeriodStart: "2026-06-01", cycleLengthDays: 28 }, true);
      const raw = await prisma.cycleConsent.findUnique({ where: { athleteId: id } });
      // Nada de salud en claro at-rest: ni la fecha ni la duración.
      expect(raw!.lastPeriodStart!.startsWith("enc:")).toBe(true);
      expect(raw!.lastPeriodStart).not.toContain("2026-06-01");
      expect(raw!.cycleLengthDays!.startsWith("enc:")).toBe(true);
      // Roundtrip descifrado para la dueña (+ consented: ya activó al registrar con consent).
      expect(await getMyCycle(prisma, id)).toEqual({ share: "full", state: "regular", lastPeriodStart: "2026-06-01", cycleLengthDays: 28, consented: true });
      // Y el coach con "full" recibe el lúteo computado desde el dato cifrado (día 9 < 14 → false).
      expect(await getCycle(prisma, id, "2026-06-10")).toEqual({ share: "full", inLutealNow: false, health: "ok", reliable: true });
    } finally {
      await prisma.athlete.delete({ where: { id } });
    }
  });
});
