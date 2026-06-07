import { describe, it, expect } from "vitest";
import { MemStorage } from "../test-utils/MemStorage";
import { readLeads, saveLead, LEADS_KEY } from "./leads";

describe("leads", () => {
  it("starts empty, appends immutably, trims fields", () => {
    const s = new MemStorage();
    expect(readLeads(s)).toEqual([]);
    saveLead(s, { nombre: "  Coach Ana ", contacto: " ana@gym.com " }, "2026-06-07T10:00:00Z");
    saveLead(s, { nombre: "Bruno", contacto: "5491100000000" }, "2026-06-07T11:00:00Z");
    const all = readLeads(s);
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ nombre: "Coach Ana", contacto: "ana@gym.com", ts: "2026-06-07T10:00:00Z" });
    expect(all[1]!.nombre).toBe("Bruno");
  });

  it("uses the ho: namespace (cleared by the demo reset) and survives corrupt JSON", () => {
    expect(LEADS_KEY.startsWith("ho:")).toBe(true);
    const s = new MemStorage();
    s.setItem(LEADS_KEY, "{not json");
    expect(readLeads(s)).toEqual([]);
  });
});
