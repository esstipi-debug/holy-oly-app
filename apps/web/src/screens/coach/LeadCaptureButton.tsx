/**
 * Demo-only (T5): "Me interesa para mi equipo" — captures a prospect lead offline. The CTA opens a
 * bottom-sheet form (visible labels, no placeholder-as-label) that saves to `ho:leads` and, if a
 * contact target is configured in leads.ts, also opens a wa.me/mailto deep link prellenado.
 * `variant="primary"` for the post-aha CTA, `"discreet"` for the always-available chip.
 */
import { useState, type CSSProperties } from "react";
import { saveLead, whatsappUrl, mailtoUrl } from "../../data/leads";

const labelStyle: CSSProperties = { display: "block", fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 4 };
const inputStyle: CSSProperties = { width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 9, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-body)", fontSize: 15, boxSizing: "border-box" };

export function LeadCaptureButton({
  variant = "discreet",
  storage = window.localStorage,
  now = () => new Date().toISOString(),
}: {
  variant?: "discreet" | "primary";
  storage?: Storage;
  now?: () => string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const valid = nombre.trim() !== "" && contacto.trim() !== "";

  const close = () => { setOpen(false); setDone(false); setNombre(""); setContacto(""); };
  const submit = () => {
    if (!valid) return;
    const lead = { nombre, contacto };
    saveLead(storage, lead, now());
    const url = whatsappUrl(lead) ?? mailtoUrl(lead);
    if (url) window.open(url, "_blank", "noopener");
    setDone(true);
  };

  const triggerStyle: CSSProperties = variant === "primary"
    ? { minHeight: 44, width: "100%", marginTop: 12, borderRadius: 9, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }
    : { minHeight: 28, padding: "4px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-accent) 45%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 10%,transparent)", color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" };

  const primaryBtn: CSSProperties = { minHeight: 44, width: "100%", marginTop: 14, borderRadius: 9, border: 0, color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>Me interesa para mi equipo</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Me interesa para mi equipo" onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.5)" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(96vw, 420px)", background: "var(--wl-surface)", borderRadius: "14px 14px 0 0", padding: "18px 18px 24px", border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)" }}>
            {done ? (
              <>
                <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18 }}>¡Gracias!</div>
                <p style={{ fontSize: 13, color: "var(--wl-muted)", lineHeight: 1.4 }}>Te contactamos para sumar a tu equipo. Quedó guardado.</p>
                <button type="button" onClick={close} style={{ ...primaryBtn, background: "var(--wl-accent)", cursor: "pointer" }}>Cerrar</button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18 }}>Me interesa para mi equipo</div>
                <p style={{ fontSize: 12.5, color: "var(--wl-muted)", margin: "4px 0 12px" }}>Dejanos tu contacto y te escribimos. Queda en tu equipo, sin spam.</p>
                <label htmlFor="lead-nombre" style={labelStyle}>Nombre</label>
                <input id="lead-nombre" style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <label htmlFor="lead-contacto" style={{ ...labelStyle, marginTop: 10 }}>WhatsApp o email</label>
                <input id="lead-contacto" style={inputStyle} value={contacto} onChange={(e) => setContacto(e.target.value)} />
                <button type="button" disabled={!valid} onClick={submit}
                  style={{ ...primaryBtn, background: valid ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-accent) 35%,transparent)", cursor: valid ? "pointer" : "not-allowed" }}>
                  Enviar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
