import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { verifyEmail } from "./authClient";

export function VerifyEmailScreen() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    if (!token) return;
    void verifyEmail(token)
      .then(() => setState("ok"))
      .catch(() => setState("err"));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--wl-bg)" }}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        {!token && <p>{t("verify.invalidLink")}</p>}
        {token && state === "idle" && <p>{t("verify.verifying")}</p>}
        {state === "ok" && <p>{t("verify.ok")}</p>}
        {state === "err" && <p>{t("verify.expired")}</p>}
        <Link to="/login" style={{ display: "inline-block", marginTop: 12, fontFamily: "var(--mono)", fontSize: 12 }}>{t("verify.goToLogin")}</Link>
      </div>
    </div>
  );
}
