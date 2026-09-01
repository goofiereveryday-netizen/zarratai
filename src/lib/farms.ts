import { createClient } from "@/lib/supabase/server";

/**
 * A row of the public.farms table.
 * RLS guarantees queries only ever return farms owned by the signed-in user.
 */
export type Farm = {
  id: string;
  user_id: string;
  name: string;
  district: string;
  tehsil: string;
  area: number;
  area_unit: string | null;
  crop: string;
  variety: string | null;
  crop_stage: string | null;
  irrigation: string | null;
  notes: string | null;
  is_selected: boolean;
  created_at: string | null;
  updated_at: string | null;
};

/** Returns the user's farms, oldest first. Empty list on error. */
export async function getFarms(): Promise<Farm[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load farms:", error.message);
    return [];
  }

  return (data ?? []) as Farm[];
}

/**
 * Returns a single farm owned by the signed-in user, or null when the farm
 * does not exist or belongs to someone else (RLS hides other users' rows).
 */
export async function getFarmById(id: string): Promise<Farm | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load farm:", error.message);
    return null;
  }

  return (data as Farm) ?? null;
}

/** Returns the farm marked with is_selected, or null when none is selected. */
export async function getSelectedFarm(): Promise<Farm | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .eq("is_selected", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load selected farm:", error.message);
    return null;
  }

  return (data as Farm) ?? null;
}
