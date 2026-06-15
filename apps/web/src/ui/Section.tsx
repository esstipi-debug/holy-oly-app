import { useId, useState, type ReactNode } from "react";

/**
 * Sección titulada — el primitivo de jerarquía del drill-down del coach. Tarjeta `var(--wl-surface)`
 * con un header consistente (eyebrow mono + título display) y, opcionalmente, colapso accesible.
 * Reemplaza la sopa de `div` con `fontSize` inline dispersos: una sola escala (eyebrow 9 / título 14)
 * vía las clases `.wl-sect*` (theme.css), tematizable por skin.
 *
 * - `collapsible`: el header pasa a `<button>` con `aria-expanded` + `aria-controls`; el cuerpo se
 *   **monta sólo cuando está abierto** (lazy) — así `RmSection`/`PrilepinSection` no hacen su fetch
 *   hasta que se abren. `defaultOpen` (default `true`) sólo aplica si `collapsible`.
 * - `right`: slot a la derecha del header (stat, badge o acción) — sólo en modo NO colapsable
 *   (en colapsable el lugar derecho lo ocupa el chevron).
 */
export function Section({
  title,
  eyebrow,
  right,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  const titles = (
    <div className="wl-sect__titles">
      {eyebrow != null && <div className="wl-sect__eyebrow">{eyebrow}</div>}
      <div className="wl-sect__title">{title}</div>
    </div>
  );

  if (!collapsible) {
    return (
      <section className="wl-sect">
        <div className="wl-sect__head">
          {titles}
          {right != null && <div className="wl-sect__right">{right}</div>}
        </div>
        <div className="wl-sect__body">{children}</div>
      </section>
    );
  }

  return (
    <section className="wl-sect">
      <button
        type="button"
        className="wl-sect__head wl-sect__head--btn"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        {titles}
        <span className="wl-sect__chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div id={bodyId} className="wl-sect__body wl-daydetail-in">
          {children}
        </div>
      )}
    </section>
  );
}
