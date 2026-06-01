import { describe, it, expect } from "vitest";
import { redactCycle } from "./cycle";

describe("redactCycle (server-side cycle redaction)", () => {
  it("min share → populated, luteal hidden (null)", () => {
    expect(redactCycle("min", "regular")).toEqual({
      share: "min", inLutealNow: null, health: "ok", reliable: true,
    });
  });

  it("full + regular → populated, luteal placeholder false", () => {
    expect(redactCycle("full", "regular")).toEqual({
      share: "full", inLutealNow: false, health: "ok", reliable: true,
    });
  });

  it("amenorrhea → referral + not reliable", () => {
    const ctx = redactCycle("full", "amenorrhea");
    expect(ctx?.health).toBe("referral");
    expect(ctx?.reliable).toBe(false);
  });

  it("unreliable state → reliable false, health ok", () => {
    expect(redactCycle("min", "unreliable")).toMatchObject({ health: "ok", reliable: false });
  });

  it("none share → undefined (nothing exposed)", () => {
    expect(redactCycle("none", "regular")).toBeUndefined();
  });
});
