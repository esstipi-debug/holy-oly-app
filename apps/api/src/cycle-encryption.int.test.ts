import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "./db/client";
import { getCycle } from "./repo";
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
      // read path decrypts → redaction reflects the real state (amenorrhea → referral)
      expect(await getCycle(prisma, id)).toEqual({
        share: "full",
        inLutealNow: false,
        health: "referral",
        reliable: false,
      });
    } finally {
      await prisma.athlete.delete({ where: { id } }); // cascades the cycleConsent row
    }
  });
});
