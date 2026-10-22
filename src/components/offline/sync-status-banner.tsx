"use client";

import { useOfflineSync } from "@/lib/offline/offline-sync-provider";

export function SyncStatusBanner() {
  const { status, pending } = useOfflineSync();
  if (status === "idle" || (status === "synced" && pending === 0)) return null;

  const message =
    status === "offline"
      ? `Offline. Your changes are saved on this device${pending ? ` (${pending} waiting to sync)` : ""}.`
      : status === "syncing"
        ? "Syncing your saved changes…"
        : status === "error"
          ? `Some changes are still waiting to sync${pending ? ` (${pending})` : ""}.`
          : `All changes are synced${pending ? `; ${pending} waiting` : ""}.`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-4 py-2 text-center text-xs ${
        status === "offline" || status === "error"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-olive-branch/20 bg-wheat-cream-light text-forest-floor"
      }`}
    >
      {message}
    </div>
  );
}
