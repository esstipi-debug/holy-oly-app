import { useId } from "react";
import { holyOlyIconSvg } from "./holyOlyIconSvg";

interface Props {
  /** Rendered width & height in px (the icon is square). */
  size?: number;
  /** Show the curved HOLY/OLY wordmark (default true). Set false for a tiny, text-free mark. */
  withText?: boolean;
  className?: string;
}

/**
 * The HOLY OLY app icon — a red 25 KG bumper plate in ¾ perspective — as an inline SVG brand
 * mark. The curved wordmark renders against the app's Saira Condensed (loaded in theme.css).
 */
export function HolyOlyIcon({ size = 72, withText = true, className }: Props) {
  // useId() can contain ":" which is invalid inside SVG url(#…) refs — strip it.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      // Static, fully-controlled markup (no user input) — safe to inject.
      dangerouslySetInnerHTML={{ __html: holyOlyIconSvg({ uid, withText }) }}
    />
  );
}
