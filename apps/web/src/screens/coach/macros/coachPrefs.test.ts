import { describe, it, expect, afterEach } from "vitest";
import { getCoachSkin, setCoachSkin, COACH_SKINS } from "./coachPrefs";

afterEach(() => localStorage.clear());

describe("coachPrefs", () => {
  it("default = legend cuando no hay nada guardado", () => {
    expect(getCoachSkin()).toBe("legend");
  });

  it("persiste y lee una skin válida", () => {
    setCoachSkin("plates");
    expect(getCoachSkin()).toBe("plates");
  });

  it("una skin desconocida cae a legend (no rompe)", () => {
    localStorage.setItem("holy-oly:coach-skin", "no-existe");
    expect(getCoachSkin()).toBe("legend");
  });

  it("ofrece legend (default/identidad) + las skins del atleta", () => {
    const ids = COACH_SKINS.map((s) => s.id);
    expect(ids[0]).toBe("legend");
    expect(ids).toContain("neon");
    expect(ids).toContain("chalk");
    expect(ids).toContain("premium");
  });
});
