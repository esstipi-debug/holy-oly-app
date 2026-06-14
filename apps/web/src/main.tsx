import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { router } from "./app/router";
import "./styles/index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<div aria-busy="true" style={{ minHeight: "100vh", background: "var(--wl-bg)" }} />}>
        <RouterProvider router={router} />
      </Suspense>
    </I18nextProvider>
  </React.StrictMode>
);
