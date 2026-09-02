import { createClient } from "@/lib/supabase/server";

export type ConsultationStatus = "active" | "completed";

export type MessageRole = "user" | "assistant" | "system";

export type MessageInputType = "text" | "image" | "voice" | "multimodal";

/**
 * A row of the public.consultations table.
 * RLS guarantees queries only ever return consultations owned by the signed-in user.
 */
export type Consultation = {
  id: string;
  user_id: string;
  farm_id: string;
  title: string | null;
  status: ConsultationStatus;
  language: string | null;
  result_json: unknown;
  created_at: string | null;
  updated_at: string | null;
};

/** A row of the public.messages table. */
export type ConsultationMessage = {
  id: string;
  consultation_id: string;
  user_id: string;
  role: MessageRole;
  input_type: MessageInputType;
  content: string | null;
  created_at: string | null;
};

/** Maximum length of a consultation title derived from the first message. */
const TITLE_MAX_LENGTH = 60;

/**
 * Derives the consultation title from the first user message using
 * deterministic truncation only — no AI, no summarisation.
 */
export function deriveConsultationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }
  // Truncate on code-point boundaries so multi-byte characters stay intact.
  const truncated = Array.from(normalized)
    .slice(0, TITLE_MAX_LENGTH - 1)
    .join("")
    .trimEnd();
  return `${truncated}…`;
}

/**
 * Returns the most recent consultation with status "active" for the given
 * farm, or null when the user has no active consultation for it.
 */
export async function getActiveConsultation(
  farmId: string
): Promise<Consultation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("farm_id", farmId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load active consultation:", error.message);
    return null;
  }

  return (data as Consultation) ?? null;
}

/** Returns the messages of a consultation, oldest first. Empty list on error. */
export async function getConsultationMessages(
  consultationId: string
): Promise<ConsultationMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("Failed to load consultation messages:", error.message);
    return [];
  }

  return (data ?? []) as ConsultationMessage[];
}

/**
 * Returns all consultations for the signed-in user, newest first.
 * RLS scopes the query so only the user's own rows are returned.
 */
export async function getUserConsultations(): Promise<Consultation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load user consultations:", error.message);
    return [];
  }

  return (data ?? []) as Consultation[];
}

/**
 * Returns a single consultation by id. RLS ensures the signed-in user
 * can only access their own consultations.
 */
export async function getConsultationById(
  id: string
): Promise<Consultation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load consultation:", error.message);
    return null;
  }

  return (data as Consultation) ?? null;
}
