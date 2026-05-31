export function WeekPicker({
  weeks,
  value,
  onChange,
}: {
  weeks: number;
  value: number;
  onChange: (week: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 3,
      }}
    >
      {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
        const on = w === value;
        return (
          <button
            type="button"
            key={w}
            onClick={() => onChange(w)}
            style={{
              flexShrink: 0,
              border: "1px solid",
              borderColor: on
                ? "var(--wl-accent)"
                : "color-mix(in srgb,var(--wl-text) 14%,transparent)",
              background: on ? "var(--wl-accent)" : "transparent",
              color: on ? "var(--wl-bg)" : "var(--wl-text)",
              fontFamily: "var(--wl-display)",
              fontWeight: 700,
              fontSize: 12,
              padding: "8px 11px",
              borderRadius: 10,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            S{w}
          </button>
        );
      })}
    </div>
  );
}
