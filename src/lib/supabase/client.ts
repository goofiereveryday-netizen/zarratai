import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getTauriAuthStorage,
  isTauriRuntime,
  TAURI_AUTH_STORAGE_KEY,
} from "@/lib/supabase/tauri-auth";

let browserClient: ReturnType<typeof createSupabaseClient> | null = null;
let tauriClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Returns a safe HTTPS URL that Supabase can use for email-confirmation
 * redirects. In the Tauri WebView the browser origin is `tauri://localhost`
 * (or `https://tauri.localhost`) — passing that through to the auth endpoint
 * triggers "invalid path specified in URL" errors. Fall back to a stable
 * production URL instead.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window === "undefined") return "https://zarratai.com/auth/callback";
  if (isTauriRuntime()) return "https://zarratai.com/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

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
