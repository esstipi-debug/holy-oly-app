/**
 * First-time onboarding guide as a single on-brand bottom card (same visual language as the
 * demo tour card — NOT a spotlight cutout, which the system avoids). Lists the role's key
 * navigation spots, then dismisses (persisting the per-user `ho:onboard:<id>` flag so it never
 * reappears). Generic + presentational: the caller supplies title, steps and the resolved key.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isOnboardingSeen, markOnboardingSeen } from "./onboardingSeen";

interface OnboardingCardProps {
  /** i18n key (e.g. `auth:onboarding.title`) — a bare literal renders verbatim (i18next returns the key on a miss). */
  title: string;
  /** i18n keys (e.g. `auth:onboarding.coach.0`) — bare literals render verbatim. */
  steps: readonly string[];
  storageKey: string;
  storage?: Storage;
  onDismiss?: () => void;
}

export function OnboardingCard({ title, steps, storageKey, storage = window.localStorage, onDismiss }: OnboardingCardProps) {
  const { t } = useTranslation("auth");
  const [open, setOpen] = useState(() => !isOnboardingSeen(storage, storageKey));
  if (!open) return null;

  const dismiss = () => {
    markOnboardingSeen(storage, storageKey);
    setOpen(false);
    onDismiss?.();
  };

  return (
    <>
      {/* In-flow spacer so the position:fixed card never traps the last element of the screen
          underneath it. Sits next to the card in the scroll flow, so it vanishes WITH the card
          on dismiss (no desync). Matches the DemoTourCard spacer criterion. */}
      <div aria-hidden style={{ height: 280 }} />
      <section
        aria-label={t("onboarding.guideLabel")}
        data-testid="onboarding-card"
        style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(92vw, 400px)", zIndex: 50, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
      >
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{t("onboarding.eyebrow")}</div>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 17, margin: "4px 0 10px", lineHeight: 1.05 }}>{t(title)}</div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 12.5, color: "var(--wl-text)", lineHeight: 1.35 }}>
              <span style={{ flex: "0 0 auto", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, color: "var(--wl-accent)" }}>{i + 1}</span>
              <span>{t(s)}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={dismiss}
          style={{ minHeight: 44, width: "100%", marginTop: 12, borderRadius: 9, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
        >
          {t("onboarding.dismiss")}
        </button>
      </section>
    </>
  );
}
