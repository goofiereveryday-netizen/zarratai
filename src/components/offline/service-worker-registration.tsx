"use client";

import { useEffect } from "react";
import { isTauriRuntime } from "@/lib/supabase/tauri-auth";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isTauriRuntime()) return;
    if (!("serviceWorker" in navigator)) return;
    const secureHost =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost";
    if (!secureHost) return;

    void navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch((error) => console.warn("Offline app-shell caching is unavailable:", error));
  }, []);

  return null;
}
