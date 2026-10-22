"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  getPendingSyncCount,
  OFFLINE_DATA_CHANGED_EVENT,
} from "./database";
import { syncUserData } from "./sync";

export type OfflineSyncState = {
  status: "idle" | "offline" | "syncing" | "synced" | "error";
  pending: number;
  lastSyncedAt: number | null;
};

const DEFAULT_STATE: OfflineSyncState = {
  status: "idle",
  pending: 0,
  lastSyncedAt: null,
};
const OfflineSyncContext = createContext<OfflineSyncState>(DEFAULT_STATE);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<OfflineSyncState>(DEFAULT_STATE);
  const userId = user?.id ?? null;

  const refreshPending = useCallback(async (activeUserId: string) => {
    try {
      const pending = await getPendingSyncCount(activeUserId);
      setState((current) => ({ ...current, pending }));
      return pending;
    } catch (error) {
      console.warn("Could not read offline sync queue:", error);
      return 0;
    }
  }, []);

  const sync = useCallback(async () => {
    if (!userId || loading) return;
    if (!navigator.onLine) {
      const pending = await refreshPending(userId);
      setState((current) => ({ ...current, status: "offline", pending }));
      return;
    }

    setState((current) => ({ ...current, status: "syncing" }));
    try {
      const result = await syncUserData(userId);
      setState({
        status: result.error ? "error" : result.pending > 0 ? "error" : "synced",
        pending: result.pending,
        lastSyncedAt: Date.now(),
      });
    } catch (error) {
      console.warn("Offline sync failed:", error);
      const pending = await refreshPending(userId);
      setState((current) => ({ ...current, status: navigator.onLine ? "error" : "offline", pending }));
    }
  }, [loading, refreshPending, userId]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setState(DEFAULT_STATE);
      return;
    }

    const handleOnline = () => void sync();
    const handleOffline = () => {
      void refreshPending(userId).then((pending) => {
        setState((current) => ({ ...current, status: "offline", pending }));
      });
    };
    const handleLocalChange = () => void sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };

    void sync();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, handleLocalChange);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, handleLocalChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loading, refreshPending, sync, userId]);

  return (
    <OfflineSyncContext.Provider value={state}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncState {
  return useContext(OfflineSyncContext);
}
