import type { CSSProperties } from "react";

/** Una opción del toggle: `[valor, etiqueta]`. El valor viaja en `onChange`; la etiqueta es
 *  el texto visible (y el nombre accesible del botón). */
export type SegmentedOption<T extends string> = readonly [value: T, label: string];

/**
 * Toggle segmentado compartido — la píldora de `var(--wl-surface)` con N botones, donde el
 * activo se pinta con `var(--wl-accent)` sobre `var(--wl-bg)`. Antes vivía inline y duplicado
 * en el drill-down del coach («Ver como») y el calendario del plan («Mapa/Lista»); extracción
 * diferida en el spec de homogeneización UI.
 *
 * Presentacional puro: el estado activo lo manda el caller vía `value`. Conserva
 * `role="group"` + `aria-label`, `aria-pressed` por botón y el área táctil de 44px en `lg`.
 *
 * `size`: `"lg"` (44px alto · padding 0 18px · 13px) para selectores de cuerpo; `"sm"`
 * (34px · 0 16px · 12px) para los embebidos en headers/secciones.
 */
export function SegmentedToggle<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  size = "lg",
  wrap = false,
  style,
}: {
  ariaLabel: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "lg" | "sm";
  /** Permite que los botones envuelvan a una 2.ª fila cuando no caben (p.ej. selector de 4). */
  wrap?: boolean;
  /** Layout del caller (p.ej. `marginTop`); se mergea sobre los estilos base del grupo. */
  style?: CSSProperties;
}) {
  const sized: CSSProperties =
    size === "lg"
      ? { minHeight: 44, padding: "0 18px", fontSize: 13 }
      : { minHeight: 34, padding: "0 16px", fontSize: 12 };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: 0,
        width: "fit-content",
        background: "var(--wl-surface)",
        borderRadius: 10,
        padding: 3,
        border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
        ...style,
      }}
    >
      {options.map(([optValue, label]) => {
        const active = optValue === value;
        return (
          <button
            key={optValue}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optValue)}
            style={{
              ...sized,
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
              fontFamily: "var(--wl-display)",
              fontWeight: 700,
              letterSpacing: ".02em",
              background: active ? "var(--wl-accent)" : "transparent",
              color: active ? "var(--wl-bg)" : "var(--wl-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
