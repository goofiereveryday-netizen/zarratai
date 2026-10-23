import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import {
  getTauriAuthStorage,
  isTauriRuntime,
  TAURI_AUTH_STORAGE_KEY,
} from "@/lib/supabase/tauri-auth";

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
        },
      });
    }
    return tauriClient;
  }

  return createBrowserClient(url, publishableKey, { isSingleton: true });
}
