import { createClient } from "@/lib/supabase/client";
import { getSelectedFarm, type Farm } from "@/lib/farms";
import {
  ASSISTANT_REPLY_FAILED,
  getActiveConsultation,
  deriveConsultationTitle,
  getConsultationMessages,
  type Consultation,
  type ConsultationMessage,
} from "@/lib/consultations";
import { IMAGE_SCAN_DEFAULT_CONTENT } from "@/lib/consultation-constants";
import { getOfflineUserId, isNetworkAvailable } from "@/lib/offline/identity";
import { saveLocalRecord } from "@/lib/offline/database";
import { syncUserData } from "@/lib/offline/sync";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_IMAGE_BASE64_CHARS = 900_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const OFFLINE_REPLY_NOTICE =
  "Saved on this device. It will sync when you are back online; the assistant needs a connection to reply.";

export type SendImageInput = {
  mimeType: string;
  base64: string;
};

export type SendMessageResult = {
  error?: string;
  message?: ConsultationMessage;
  consultation?: Consultation;
  assistantMessage?: ConsultationMessage;
  assistantError?: string;
};

export type NewConsultationResult = {
  error?: string;
};

function requestSync(userId: string): void {
  if (isNetworkAvailable()) {
    void syncUserData(userId).catch((error) => {
      console.warn("Consultation changes remain queued for sync:", error);
    });
  }
}

function getAuthUserId(): Promise<string | null> {
  return getOfflineUserId();
}

export async function sendMessage(
  content: string,
  image?: SendImageInput,
): Promise<SendMessageResult> {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Not authenticated." };

  const trimmed = content.trim();
  if (!trimmed && !image) {
    return { error: "Write a message or attach a photo first." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: "Message is too long. Please send a shorter message." };
  }
  if (image) {
    if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
      return {
        error: "That image format is not supported. Please send a JPEG, PNG or WebP photo.",
      };
    }
    if (
      !BASE64_PATTERN.test(image.base64) ||
      image.base64.length > MAX_IMAGE_BASE64_CHARS
    ) {
      return { error: "The photo is too large to scan. Please try a smaller photo." };
    }
  }

  const displayContent = image ? trimmed || IMAGE_SCAN_DEFAULT_CONTENT : trimmed;
  const farm = await getSelectedFarm();
  if (!farm) {
    return { error: "Select a farm in My Crops before starting a consultation." };
  }

  let consultation = await getActiveConsultation(farm.id);
  const now = new Date().toISOString();
  if (!consultation) {
    consultation = {
      id: crypto.randomUUID(),
      user_id: userId,
      farm_id: farm.id,
      title: deriveConsultationTitle(displayContent),
      status: "active",
      language: null,
      result_json: null,
      created_at: now,
      updated_at: now,
    };
  } else {
    consultation = { ...consultation, updated_at: now };
  }
  await saveLocalRecord("consultations", consultation);

  const message: ConsultationMessage = {
    id: crypto.randomUUID(),
    consultation_id: consultation.id,
    user_id: userId,
    role: "user",
    input_type: image ? "image" : "text",
    content: displayContent,
    created_at: now,
  };
  await saveLocalRecord("messages", message);
  requestSync(userId);

  if (!isNetworkAvailable()) {
    const photoNote = image
      ? " The photo itself is not retained for later analysis, so attach it again after reconnecting."
      : "";
    return {
      message,
      consultation,
      assistantError: `${OFFLINE_REPLY_NOTICE}${photoNote}`,
    };
  }

  const history = await getConsultationMessages(consultation.id);
  let replyText: string | null = null;
  const supabase = createClient();

  // Read the session token and pass Authorization explicitly on the invoke
  // call. setAuth() alone can leave the FunctionsClient header-less in the
  // Tauri WebView (the SDK's auth listener may not fire for sessions
  // restored from localStorage), which the Edge Function sees as a 401.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    supabase.functions.setAuth(accessToken);
  }

  try {
    const { data: replyData, error: replyError } = await supabase.functions.invoke(
      "assistant-reply",
      {
        body: {
          farm: farm as Farm,
          history: (image ? history.filter((item) => item.id !== message.id) : history)
            .map((item) => ({ ...item, image_url: null })),
          ...(image ? { image: { mimeType: image.mimeType, base64: image.base64 } } : {}),
        },
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      },
    );
    if (replyError) {
      if (replyError instanceof FunctionsHttpError) {
        const status = replyError.context?.status;
        let bodyText = "";
        try {
          bodyText = await replyError.context.text();
        } catch {
          // Response body already consumed or unreadable.
        }
        console.error(
          `[assistant-reply] FunctionsHttpError status=${status} body=${
            bodyText.slice(0, 500) || replyError.message
          }`,
        );
      } else if (replyError instanceof FunctionsFetchError) {
        console.error(
          "[assistant-reply] FunctionsFetchError (network/CSP blocked — check connect-src for https://*.supabase.co):",
          replyError.message,
        );
      } else if (replyError instanceof FunctionsRelayError) {
        console.error(
          "[assistant-reply] FunctionsRelayError (function not deployed or relay issue):",
          replyError.message,
        );
      } else {
        console.error("[assistant-reply] Functions error:", replyError.message);
      }
    } else if (replyData && typeof replyData === "object" && "text" in replyData) {
      replyText = (replyData as { text: string }).text;
    } else if (replyData && typeof replyData === "object" && "error" in replyData) {
      // HTTP 200 carrying an error payload (e.g. GEMINI_API_KEY secret missing).
      console.error(
        "[assistant-reply] HTTP 200 with error payload:",
        (replyData as { error: string }).error,
      );
    } else {
      console.error(
        "[assistant-reply] Unexpected response payload:",
        JSON.stringify(replyData)?.slice(0, 500) ?? String(replyData),
      );
    }
  } catch (error) {
    console.error(
      "[assistant-reply] Unexpected invoke failure:",
      error instanceof Error ? error.message : error,
    );
  }

  if (!replyText) {
    return { message, consultation, assistantError: ASSISTANT_REPLY_FAILED };
  }

  const assistantMessage: ConsultationMessage = {
    id: crypto.randomUUID(),
    consultation_id: consultation.id,
    user_id: userId,
    role: "assistant",
    input_type: "text",
    content: replyText,
    created_at: new Date().toISOString(),
  };
  await saveLocalRecord("messages", assistantMessage);
  consultation = { ...consultation, updated_at: assistantMessage.created_at };
  await saveLocalRecord("consultations", consultation);
  requestSync(userId);

  return { message, consultation, assistantMessage };
}

export async function startNewConsultation(): Promise<NewConsultationResult> {
  const userId = await getAuthUserId();
  if (!userId) return { error: "Not authenticated." };

  const farm = await getSelectedFarm();
  if (!farm) {
    return { error: "Select a farm in My Crops before starting a consultation." };
  }

  const active = await getActiveConsultation(farm.id);
  if (active) {
    await saveLocalRecord("consultations", {
      ...active,
      status: "completed",
      updated_at: new Date().toISOString(),
    });
    requestSync(userId);
  }
  return {};
}
