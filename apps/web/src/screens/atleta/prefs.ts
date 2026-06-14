/** Athlete-local UI preferences (skin + check-in interaction), persisted in localStorage. */
export type CheckinVariant = "tap" | "dial";

const SKIN_KEY = "holy-oly:atleta-skin";
const VARIANT_KEY = "holy-oly:atleta-checkin-variant";
// Keep in sync with the .wl--* skin classes in theme.css.
const SKINS = ["neon", "neonlight", "bloomnight", "plates", "premium", "chalk"] as const;

export function getSkin(): string {
  const s = localStorage.getItem(SKIN_KEY);
  return s && (SKINS as readonly string[]).includes(s) ? s : "neon";
}
export function setSkin(skin: string): void {
  localStorage.setItem(SKIN_KEY, skin);
}
export function getVariant(): CheckinVariant {
  return localStorage.getItem(VARIANT_KEY) === "dial" ? "dial" : "tap";
}
export function setVariant(v: CheckinVariant): void {
  localStorage.setItem(VARIANT_KEY, v);
}
