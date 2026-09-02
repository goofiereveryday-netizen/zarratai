"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSelectedFarm } from "@/lib/farms";
import {
  ASSISTANT_REPLY_FAILED,
  generateAssistantReply,
} from "@/lib/ai/assistant";
import {
  deriveConsultationTitle,
  getConsultationMessages,
  type Consultation,
  type ConsultationMessage,
} from "@/lib/consultations";

/** Maximum message length accepted from the composer. */
const MAX_MESSAGE_LENGTH = 4000;

export type SendMessageResult = {
  error?: string;
  /** The persisted user message. */
  message?: ConsultationMessage;
  /** The consultation the message was saved to. */
  consultation?: Consultation;
  /** The persisted assistant reply, when one could be generated and saved. */
  assistantMessage?: ConsultationMessage;
  /**
   * Non-technical notice when the assistant reply failed. The user message
   * above was still saved, so the client must not roll it back.
   */
  assistantError?: string;
};

export type NewConsultationResult = {
  error?: string;
};

/**
 * Returns the signed-in user's Supabase client and id.
 * Redirects to /login when there is no session — server actions are public
 * entry points, so every action re-checks authentication.
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, userId: user.id };
}

/**
 * Saves a user message to the active consultation for the selected farm,
 * then generates the assistant reply for it.
 *
 * Order matters: the user message is persisted first, so it survives even
 * when the Gemini call fails. The reply — when generated — is saved as an
 * assistant message in the same consultation. The active consultation is
 * always re-derived from the database — the database, not the client, is
 * the source of truth.
 */
export async function sendMessage(content: string): Promise<SendMessageResult> {
  const { supabase, userId } = await getAuthContext();

  const trimmed = content.trim();
  if (!trimmed) {
    return { error: "Write a message first." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: "Message is too long. Please send a shorter message." };
  }

  const farm = await getSelectedFarm();
  if (!farm) {
    return { error: "Select a farm in My Farms before starting a consultation." };
  }

  // Find the active consultation for the selected farm (RLS scopes the query
  // to the signed-in user). A consultation is created only when none is
  // active, so the farm association is preserved on every consultation.
  const { data: existing, error: fetchError } = await supabase
    .from("consultations")
    .select("*")
    .eq("farm_id", farm.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return { error: "Could not send the message. Please try again." };
  }

  const now = new Date().toISOString();
  let consultation = (existing as Consultation) ?? null;

  if (!consultation) {
    const { data: created, error: createError } = await supabase
      .from("consultations")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        farm_id: farm.id,
        title: deriveConsultationTitle(trimmed),
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (createError) {
      return { error: "Could not send the message. Please try again." };
    }

    consultation = created as Consultation;
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      id: crypto.randomUUID(),
      consultation_id: consultation.id,
      user_id: userId,
      role: "user",
      input_type: "text",
      content: trimmed,
      created_at: now,
    })
    .select("*")
    .single();

  if (messageError) {
    return { error: "Could not send the message. Please try again." };
  }

  revalidatePath("/assistant");

  // The user message is safely stored — generate the reply after it, with
  // the recent conversation (including the message just saved) and the
  // selected farm as context.
  const history = await getConsultationMessages(consultation.id);
  const reply = await generateAssistantReply({ farm, history });

  if ("error" in reply) {
    // Keep the saved user message; only the reply is missing.
    return {
      message: message as ConsultationMessage,
      consultation,
      assistantError: reply.error,
    };
  }

  const { data: assistantMessage, error: assistantInsertError } = await supabase
    .from("messages")
    .insert({
      id: crypto.randomUUID(),
      consultation_id: consultation.id,
      user_id: userId,
      role: "assistant",
      input_type: "text",
      content: reply.text,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (assistantInsertError) {
    console.error(
      "Failed to save assistant message:",
      assistantInsertError.message
    );
    return {
      message: message as ConsultationMessage,
      consultation,
      assistantError: ASSISTANT_REPLY_FAILED,
    };
  }

  // Keep the consultation's updated_at in step with its latest message.
  // Non-fatal: ordering relies on created_at, so a failure here is harmless.
  await supabase
    .from("consultations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", consultation.id);

  return {
    message: message as ConsultationMessage,
    consultation,
    assistantMessage: assistantMessage as ConsultationMessage,
  };
}

/**
 * Ends the active consultation for the selected farm so the next message
 * starts a separate consultation. No empty consultation row is created —
 * consultations are created when the first message is sent.
 */
export async function startNewConsultation(): Promise<NewConsultationResult> {
  const { supabase } = await getAuthContext();

  const farm = await getSelectedFarm();
  if (!farm) {
    return { error: "Select a farm in My Farms before starting a consultation." };
  }

  const { data: active, error: fetchError } = await supabase
    .from("consultations")
    .select("id")
    .eq("farm_id", farm.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return { error: "Could not start a new consultation. Please try again." };
  }

  if (active) {
    // The .select() check verifies a row was actually updated: RLS blocks
    // updates to other users' consultations, which would otherwise be a
    // silent no-op.
    const { data: completed, error: completeError } = await supabase
      .from("consultations")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", active.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (completeError || !completed) {
      return { error: "Could not start a new consultation. Please try again." };
    }
  }

  revalidatePath("/assistant");
  return {};
}
