/**
 * First-time onboarding copy, separated from the card render so the wording can change
 * without touching the component. Contract: a short title + a list of 4 short steps per role.
 *
 * Since Fase i18n these export i18n KEYS (namespace `auth`), not literal strings — the same
 * symbol names the callers (HomeScreen / Equipo) already pass through to `<OnboardingCard>`,
 * which resolves them with its own `t()`. A literal string passed in dev still renders verbatim
 * (i18next returns the key on a miss), so the card stays a drop-in for ad-hoc copy.
 */
export const ONBOARDING_TITLE_COACH = "auth:onboarding.title";
export const ONBOARDING_TITLE_ATLETA = "auth:onboarding.title";

export const COACH_STEPS: readonly string[] = [
  "auth:onboarding.coach.0",
  "auth:onboarding.coach.1",
  "auth:onboarding.coach.2",
  "auth:onboarding.coach.3",
];

export const ATLETA_STEPS: readonly string[] = [
  "auth:onboarding.atleta.0",
  "auth:onboarding.atleta.1",
  "auth:onboarding.atleta.2",
  "auth:onboarding.atleta.3",
];
