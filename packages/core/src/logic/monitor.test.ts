import { describe, it, expect } from "vitest";
import { acwrState, chronic, acwr, imrBandState } from "./monitor";

describe("monitor", () => {
  it("acwrState: banda segura 0.8–1.3", () => {
    expect(acwrState(1.0)).toBe("ok");
    expect(acwrState(1.4)).toBe("warn");
    expect(acwrState(0.7)).toBe("warn");
    expect(acwrState(1.6)).toBe("alert");
  });
  it("chronic = media móvil de 4 semanas", () => {
    expect(chronic([100, 100, 100, 100])).toEqual([100, 100, 100, 100]);
    expect(chronic([400, 0, 0, 0])[0]).toBe(400);
    expect(chronic([400, 0, 0, 0])[3]).toBe(100);
  });
  it("acwr = aguda / crónica", () => {
    expect(acwr([100, 100, 100, 200])[3]).toBeCloseTo(200 / 125);
  });
  it("imrBandState: warn fuera de la banda esperada (±2)", () => {
    expect(imrBandState(80, [75, 82])).toBe("ok");
    expect(imrBandState(90, [75, 82])).toBe("warn");
    expect(imrBandState(70, [75, 82])).toBe("warn");
  });
});
