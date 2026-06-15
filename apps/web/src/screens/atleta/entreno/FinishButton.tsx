import { useEffect, useRef, useState } from "react";

const FIN_WORDS = ["Terminar", "Guardar entreno"];

function prefersReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/**
 * Botón Terminar con efecto glitch "Spider-Verse": alterna TERMINAR ↔ GUARDAR ENTRENO y en cada cambio
 * dispara el glitch (capas cyan/magenta + skew + scanline, todo CSS). El swap de texto corre por JS.
 * Respeta prefers-reduced-motion (texto fijo, sin swap). `busy` → "Guardando…" deshabilitado.
 * `glowing` → glow neón sostenido (todos los ejercicios hechos).
 */
export function FinishButton({ onFinish, busy, glowing }: { onFinish: () => void; busy: boolean; glowing: boolean }) {
  const [i, setI] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const reduced = useRef(prefersReducedMotion());
  const animate = !reduced.current && !busy;

  useEffect(() => {
    if (!animate) return;
    let glitchTO: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setGlitch(true);
      glitchTO = setTimeout(() => setGlitch(false), 460);
      setI((p) => (p + 1) % FIN_WORDS.length);
    }, 2800);
    return () => { clearInterval(id); clearTimeout(glitchTO); };
  }, [animate]);

  const word = busy ? "Guardando…" : animate ? FIN_WORDS[i]! : "Terminar · guardar entreno";

  return (
    <div className="et-fin-wrap">
      <button
        type="button"
        className={"et-fin" + (glitch ? " is-glitch" : "") + (glowing && !busy ? " et-glow-cta" : "")}
        onClick={onFinish}
        disabled={busy}
        aria-label="guardar entreno"
      >
        <span className="et-fin__surf" aria-hidden />
        <span className="et-fin__txt">{word}</span>
        <span className="et-fin__layer et-fin__layer--c" aria-hidden>{word}</span>
        <span className="et-fin__layer et-fin__layer--m" aria-hidden>{word}</span>
        <span className="et-fin__slice" aria-hidden />
      </button>
    </div>
  );
}
