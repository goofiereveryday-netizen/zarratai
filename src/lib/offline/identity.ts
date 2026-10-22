import { createClient } from "@/lib/supabase/client";

export async function getOfflineUserId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data, error } = await createClient().auth.getSession();
  if (error) {
    console.warn("Could not read the saved auth session:", error.message);
    return null;
  }
  return data.session?.user.id ?? null;
}

export function isNetworkAvailable(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}
