import {
  getLocalActiveConsultation,
  getLocalConsultation,
  getLocalConsultations,
  getLocalMessages,
} from "@/lib/offline/database";
import { getOfflineUserId, isNetworkAvailable } from "@/lib/offline/identity";
import { syncUserData } from "@/lib/offline/sync";

export const ASSISTANT_REPLY_FAILED =
  "Your message was saved, but the assistant could not reply right now. Please try again in a moment.";

export type ConsultationStatus = "active" | "completed";
export type MessageRole = "user" | "assistant" | "system";
export type MessageInputType = "text" | "image" | "voice" | "multimodal";

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

export type ConsultationMessage = {
  id: string;
  consultation_id: string;
  user_id: string;
  role: MessageRole;
  input_type: MessageInputType;
  content: string | null;
  created_at: string | null;
};

const TITLE_MAX_LENGTH = 60;

export function deriveConsultationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= TITLE_MAX_LENGTH) return normalized;
  const truncated = Array.from(normalized)
    .slice(0, TITLE_MAX_LENGTH - 1)
    .join("")
    .trimEnd();
  return `${truncated}…`;
}

function refreshInBackground(userId: string): void {
  if (isNetworkAvailable()) {
    void syncUserData(userId).catch((error) => {
      console.warn("Background consultation sync failed:", error);
    });
  }
}

export async function getActiveConsultation(farmId: string): Promise<Consultation | null> {
  const userId = await getOfflineUserId();
  if (!userId) return null;

  let consultation = await getLocalActiveConsultation(userId, farmId);
  if (consultation) {
    refreshInBackground(userId);
    return consultation;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    consultation = await getLocalActiveConsultation(userId, farmId);
  }
  return consultation;
}

export async function getConsultationMessages(
  consultationId: string,
): Promise<ConsultationMessage[]> {
  const userId = await getOfflineUserId();
  if (!userId) return [];

  let messages = await getLocalMessages(userId, consultationId);
  if (messages.length > 0) {
    refreshInBackground(userId);
    return messages;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    messages = await getLocalMessages(userId, consultationId);
  }
  return messages;
}

export async function getUserConsultations(): Promise<Consultation[]> {
  const userId = await getOfflineUserId();
  if (!userId) return [];

  let consultations = await getLocalConsultations(userId);
  if (consultations.length > 0) {
    refreshInBackground(userId);
    return consultations;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    consultations = await getLocalConsultations(userId);
  }
  return consultations;
}

export async function getConsultationById(id: string): Promise<Consultation | null> {
  const userId = await getOfflineUserId();
  if (!userId) return null;

  let consultation = await getLocalConsultation(userId, id);
  if (consultation) {
    refreshInBackground(userId);
    return consultation;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    consultation = await getLocalConsultation(userId, id);
  }
  return consultation;
}
