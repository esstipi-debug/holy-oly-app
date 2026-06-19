/** Coach-local skin preference, persisted in localStorage. Separada de la del atleta
 *  (`holy-oly:atleta-skin`) para que un coach y una atleta en el mismo navegador no se pisen.
 *  Default = "legend" (la identidad oro/metal del coach). */
const COACH_SKIN_KEY = "holy-oly:coach-skin";

/** Skins ofrecidas al coach: legend (identidad, default) + las mismas que el atleta.
 *  `id` debe coincidir con una clase `.wl--<id>` de theme.css; `sw` = 3 colores de muestra. */
export const COACH_SKINS: ReadonlyArray<{ id: string; nm: string; sw: readonly [string, string, string] }> = [
  { id: "legend", nm: "Legend", sw: ["#0A0B0E", "#E9C46A", "#2EE6A0"] },
  { id: "neon", nm: "Neon PR", sw: ["#07070f", "#c8ff2d", "#1fe7ff"] },
  { id: "neonlight", nm: "Neon Bloom", sw: ["#fdeef6", "#ff2e9a", "#8a5cff"] },
  { id: "bloomnight", nm: "Neon Bloom · Noche", sw: ["#150a16", "#ff3ba6", "#a06bff"] },
  { id: "plates", nm: "Plates", sw: ["#15171a", "#e23b2e", "#2274d4"] },
  { id: "premium", nm: "Premium", sw: ["#0d1016", "#e9b365", "#37d6b8"] },
  { id: "chalk", nm: "Chalk", sw: ["#e7e3d8", "#ff5400", "#2b59ff"] },
];

export function getCoachSkin(): string {
  const s = localStorage.getItem(COACH_SKIN_KEY);
  return s && COACH_SKINS.some((k) => k.id === s) ? s : "legend";
}

export function setCoachSkin(skin: string): void {
  localStorage.setItem(COACH_SKIN_KEY, skin);
}
