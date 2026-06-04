import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Modal focus management (WCAG 2.2 — focus order / no keyboard trap escape).
 * While `active` is true, for the element the returned ref is attached to:
 *  - moves focus into it on activation (first focusable child, else the element itself),
 *  - traps Tab / Shift+Tab so focus cycles within it,
 *  - restores focus to the previously-focused element when it deactivates or unmounts.
 *
 * Attach the ref to the dialog element and give that element `tabIndex={-1}` so it can
 * receive focus as a fallback when it has no focusable children.
 *
 * StrictMode-safe: the previously-focused element is re-captured on every (re)mount, and
 * focus is restored in cleanup on both deactivation (`active` → false) and unmount, so the
 * dev-only mount→cleanup→remount cycle leaves focus on the dialog and the trigger captured.
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Move focus into the dialog: first focusable child, else the container itself.
    (focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || activeEl === container)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever opened the dialog (the trigger).
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
}
