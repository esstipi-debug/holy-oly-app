import { MACROCYCLES } from "@holy-oly/core";
import { macroFilter, deriveRecovery, focusTag, levelLabel } from "./macroFilter";

test("no filters returns the whole catalog", () => {
  expect(macroFilter(MACROCYCLES, { family: "Todos", days: "Todos", query: "" }).length).toBe(MACROCYCLES.length);
});

test("filters by family", () => {
  const out = macroFilter(MACROCYCLES, { family: "Ruso", days: "Todos", query: "" });
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((m) => m.family === "Ruso")).toBe(true);
});

test("filters by days via the frequency string", () => {
  const out = macroFilter(MACROCYCLES, { family: "Todos", days: "6d", query: "" });
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((m) => m.frequency.includes("6"))).toBe(true);
});

test("text query matches name accent-insensitively", () => {
  const out = macroFilter(MACROCYCLES, { family: "Todos", days: "Todos", query: "bulgaro" });
  expect(out.some((m) => m.name.includes("Búlgaro"))).toBe(true);
});

test("filters AND together; an impossible combo is empty", () => {
  expect(macroFilter(MACROCYCLES, { family: "Ruso", days: "2d", query: "" })).toEqual([]);
});

test("deriveRecovery = clamp(6 - max(intensity, volume), 1, 5)", () => {
  expect(deriveRecovery(MACROCYCLES.find((m) => m.id === "ruso-5d")!)).toBe(1); // i3 v5 → 1
  expect(deriveRecovery(MACROCYCLES.find((m) => m.id === "cubano-int-5d")!)).toBe(3); // i3 v3 → 3
});

test("focusTag and levelLabel reflect the program", () => {
  expect(focusTag(MACROCYCLES.find((m) => m.id === "ruso-5d")!)).toBe("volumen"); // volume 5
  expect(levelLabel("intermediate")).toBe("Intermedio");
});
