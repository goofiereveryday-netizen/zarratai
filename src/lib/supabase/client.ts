import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getTauriAuthStorage,
  isTauriRuntime,
  TAURI_AUTH_STORAGE_KEY,
} from "@/lib/supabase/tauri-auth";

let browserClient: ReturnType<typeof createSupabaseClient> | null = null;
let tauriClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.",
    );
  }

  if (isTauriRuntime()) {
    if (!tauriClient) {
      tauriClient = createSupabaseClient(url, publishableKey, {
        auth: {
          storage: getTauriAuthStorage(),
          storageKey: TAURI_AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      });
    }
    return tauriClient;
  }

  if (!browserClient) {
    browserClient = createSupabaseClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return browserClient;
}
