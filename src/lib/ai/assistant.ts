import type { Farm } from "@/lib/farms";
import type { ConsultationMessage } from "@/lib/consultations";
import { generateGeminiText, type GeminiTurn } from "./gemini";

/**
 * Behaviour rules for the consultation assistant at the current build stage.
 * Updated in later steps when RAG, image analysis and verified treatment
 * data are connected.
 */
const SYSTEM_PROMPT = `You are ZarratAI, an agricultural decision-support assistant for farmers in Punjab, Pakistan.

Your job at this stage:
- Help the farmer describe the problem on the farm and decide what to do next.
- Give clear, practical guidance the farmer can act on.
- Use the farm details provided below as context when they are relevant.

How to communicate:
- Reply in the language the farmer writes in (Urdu, Punjabi or English).
- Be concise and practical: short paragraphs or simple lists.
- If the description is not enough to identify the problem, say so and ask one or two high-value follow-up questions (for example: where exactly the symptoms appear, when they started, how they spread, or recent irrigation and fertilizer).
- Never present a diagnosis as certain when the evidence does not support it. Separate what is likely from what is still unclear.
- Do not invent statistics, percentages or sources.

Strict limits at this stage:
- Do NOT give pesticide dosages, formulations or final pesticide recommendations. Never invent pesticide names, brands, active ingredients or restrictions. If the farmer asks for a spray or medicine, say that verified treatment recommendations arrive in a later step and focus on what to check and confirm first.
- Do NOT recommend organic, homemade or other non-chemical treatments either.
- You cannot see images and you have no weather data. Reason only from the farmer's description and the farm details below.`;

/** How many of the most recent messages are sent to the model as context. */
const MAX_HISTORY_MESSAGES = 20;

/**
 * Non-technical notice shown whenever an assistant reply cannot be produced.
 * Never includes upstream details — those stay in the server log.
 */
export const ASSISTANT_REPLY_FAILED =
  "Your message was saved, but the assistant could not reply right now. Please try again in a moment.";

export type AssistantReplyResult = { text: string } | { error: string };

/**
 * Generates the assistant reply for a consultation: system prompt + farm
 * context + the recent conversation, sent to Gemini. Returns a friendly
 * error instead of throwing so the caller can keep the saved user message.
 */
export async function generateAssistantReply(options: {
  farm: Farm;
  /** Conversation history, oldest first, including the message just saved. */
  history: ConsultationMessage[];
}): Promise<AssistantReplyResult> {
  const turns = toGeminiTurns(options.history);
  if (turns.length === 0) {
    console.error("Assistant reply requested with no usable history.");
    return { error: ASSISTANT_REPLY_FAILED };
  }

  try {
    const text = await generateGeminiText({
      systemInstruction: buildSystemInstruction(options.farm),
      turns,
    });
    return { text };
  } catch (err) {
    console.error(
      "Failed to generate assistant reply:",
      err instanceof Error ? err.message : err
    );
    return { error: ASSISTANT_REPLY_FAILED };
  }
}

/** Combines the behavioural prompt with the selected farm's details. */
function buildSystemInstruction(farm: Farm): string {
  const lines: string[] = [`- Farm name: ${farm.name}`];
  lines.push(`- Location: ${farm.district} District, ${farm.tehsil} Tehsil`);
  lines.push(`- Area: ${farm.area} ${farm.area_unit ?? "acres"}`);
  lines.push(`- Crop: ${farm.crop}`);
  if (farm.variety) lines.push(`- Variety: ${farm.variety}`);
  if (farm.crop_stage) lines.push(`- Crop stage: ${farm.crop_stage}`);
  if (farm.irrigation) lines.push(`- Irrigation: ${farm.irrigation}`);
  if (farm.notes) lines.push(`- Farmer's notes: ${farm.notes}`);

  return [
    SYSTEM_PROMPT,
    "Farm details (entered by the farmer — use as context):",
    lines.join("\n"),
  ].join("\n\n");
}

/**
 * Maps stored messages to Gemini turns: user messages become "user",
 * assistant messages become "model", system messages are skipped. Only the
 * most recent messages are kept, and runs of consecutive same-role messages
 * (possible when an earlier reply failed) are merged because Gemini expects
 * the roles to alternate.
 */
function toGeminiTurns(history: ConsultationMessage[]): GeminiTurn[] {
  const turns: GeminiTurn[] = [];

  for (const message of history) {
    const content = message.content?.trim();
    if (!content || message.role === "system") continue;

    const role: GeminiTurn["role"] =
      message.role === "assistant" ? "model" : "user";
    const previous = turns[turns.length - 1];
    if (previous && previous.role === role) {
      previous.text = `${previous.text}\n\n${content}`;
    } else {
      turns.push({ role, text: content });
    }
  }

  const recent = turns.slice(-MAX_HISTORY_MESSAGES);
  // Truncation can leave a model turn first — conversations must open with
  // a user turn, so drop any leading model turns.
  while (recent.length > 0 && recent[0].role === "model") {
    recent.shift();
  }
  return recent;
}
