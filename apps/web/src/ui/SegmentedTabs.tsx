import type { CSSProperties } from "react";
import type { SegmentedOption } from "./SegmentedToggle";

/**
 * Toggle segmentado de la cara ATLETA — la barra de ancho completo con botones bordeados
 * (clase `.ho-seg` en `atleta.css`, con su skin `.wl--chalk`). Es a propósito distinto de la
 * píldora del coach ([[SegmentedToggle]]): cada mundo mantiene su look. Antes vivía como
 * `className="ho-seg"` + `aria-pressed` a mano en CicloSection (×2) y CuentaMin.
 *
 * Reutiliza el CSS de `.ho-seg` (cero cambio visual) y agrega `role="group"` + `aria-label` y
 * `aria-pressed`/`type="button"` de forma consistente. Presentacional puro.
 */
export function SegmentedTabs<T extends string>({ ariaLabel, options, value, onChange, style }: {
  ariaLabel: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Layout del caller (p.ej. `marginTop`). */
  style?: CSSProperties;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="ho-seg" style={style}>
      {options.map(([optValue, label]) => {
        const active = optValue === value;
        return (
          <button
            key={optValue}
            type="button"
            aria-pressed={active}
            className={active ? "on" : ""}
            onClick={() => onChange(optValue)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
