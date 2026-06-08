/**
 * First-time onboarding "visto" flag, keyed per user so coach/atleta on the same device
 * (and distinct real users) each get their own tour. Pure given the Storage passed in.
 * Mirrors the demo-tour persistence (`data/demoTour.ts`) but lives in the onboarding module
 * and is namespaced separately so the demo reset never touches real-user onboarding.
 */
export function onboardingKey(userId: string): string {
  return `ho:onboard:${userId}`;
}

export function isOnboardingSeen(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) === "1";
  } catch {
    // Storage unavailable (private mode, disabled): degrade to "seen" so we never block
    // the screen by repeatedly trying to show the card.
    return true;
  }
}

export function markOnboardingSeen(storage: Storage, key: string): void {
  try {
    storage.setItem(key, "1");
  } catch {
    // Best-effort: if we can't persist, the card may reappear next mount — acceptable.
  }
}
