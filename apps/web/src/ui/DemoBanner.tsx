import { useEffect, useState } from "react";
import { useAuthMaybe } from "../auth/AuthContext";
import { subscribeReadOnly } from "./readOnlyNotice";
import { Toast } from "./Toast";

/**
 * Sticky banner shown ONLY in the public read-only demo session (user.demo === true). Frames the
 * experience — "you're in the real product, with example data, read-only" — and converts via a
 * "create your account" CTA. Also flashes a toast when a write is blocked by the server gate, so a
 * demo visitor who taps an edit affordance gets a friendly explanation instead of a dead click.
 */
export function DemoBanner() {
  const auth = useAuthMaybe();
  const user = auth?.user;
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeReadOnly(() => {
      setBlocked(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setBlocked(false), 3200);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!user?.demo) return null;

  const exitToSignup = async (): Promise<void> => {
    try {
      await auth?.logout();
    } catch {
      /* leave the demo anyway */
    }
    window.location.href = "/login?mode=signup";
  };

  return (
    <>
      <div
        role="status"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "8px 14px",
          background: "var(--wl-accent)",
          color: "var(--wl-bg)",
          fontFamily: "var(--wl-display)",
          fontWeight: 700,
          fontSize: 12.5,
          lineHeight: 1.3,
          textAlign: "center",
          boxShadow: "0 2px 14px -4px rgba(0,0,0,.5)",
        }}
      >
        <span>🔒 MODO DEMO · solo lectura — estás en el producto real, con datos de ejemplo.</span>
        <button
          type="button"
          onClick={() => void exitToSignup()}
          style={{
            flexShrink: 0,
            cursor: "pointer",
            border: 0,
            borderRadius: 999,
            padding: "5px 13px",
            fontFamily: "var(--wl-display)",
            fontWeight: 800,
            fontSize: 12,
            background: "var(--wl-bg)",
            color: "var(--wl-accent)",
          }}
        >
          Crear mi cuenta gratis
        </button>
      </div>
      <Toast message="Modo demo: solo lectura — creá tu cuenta para editar." show={blocked} />
    </>
  );
}
