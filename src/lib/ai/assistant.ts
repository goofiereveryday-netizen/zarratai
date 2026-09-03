import type { Farm } from "@/lib/farms";
import type { ConsultationMessage } from "@/lib/consultations";
import {
  generateKnowledgeEmbedding,
  searchKnowledgeChunks,
  type MatchedKnowledgeChunk,
} from "@/lib/knowledge/rag";
import { generateGeminiText, type GeminiTurn } from "./gemini";

/**
 * Behaviour rules for the consultation assistant. Retrieved knowledge
 * (RAG) from the knowledge layer is connected as supporting evidence;
 * image analysis and verified treatment data are later steps.
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

Using the retrieved agricultural knowledge (when provided below):
- HARD RULE: when retrieved chunks are provided, use ONLY facts explicitly present in those chunks for agricultural claims. Do NOT add unsourced agricultural facts from your own knowledge, and do NOT supplement the answer with general agricultural knowledge.
- When retrieved context exists: answer only from that context, and ask the farmer follow-up questions when information you need is missing.
- Retrieved chunks are supporting evidence, not verified current guidance. Chunks with verification_status = requires_current_verification are manual-derived supporting information — describe them that way.
- Never claim the training manual it comes from is an official Government of Punjab publication — its publisher is unverified.
- Knowledge with verification_status = requires_current_verification may support diagnosis, symptoms, scouting, general agronomy and cultural, physical or IPM guidance.
- It MUST NOT independently support actionable pesticide recommendations.
- When a chunk has pesticide_actionable = false, there must be absolutely no pesticide-specific recommendation and no treatment threshold. Do not give a product-specific pesticide name, dose, application rate, PHI (pre-harvest interval) or REI (re-entry interval), and do not claim that a pesticide is currently registered based on that chunk.
- If current verified pesticide evidence is unavailable, clearly say that current pesticide and product guidance should be verified from an official or current source.
- Attribute manual-derived knowledge plainly, for example "Based on the dealer training manual (publisher unverified), page 44…". Never label it as Punjab Government guidance.
- Do not invent or add scouting procedures, pest counting methods, economic thresholds, weather conditions, beneficial insect advice, crop-stage treatment rules, treatment timing, pesticide or fungicide names, active ingredients, rates or doses, or PHI/REI unless they are explicitly present in the retrieved context AND allowed by its pesticide_actionable value.
- When the retrieved evidence is insufficient for part of the question, say: "The retrieved sources do not contain enough verified information to answer that part safely." Then ask the farmer for relevant observations or recommend checking a current official source.
- If NO retrieved chunks are relevant at all, you may answer from general agricultural knowledge, but the whole answer must begin with: "General guidance — not verified from ZarratAI's retrieved sources:"

Pesticide and treatment questions — whenever retrieved chunks exist and their pesticide_actionable is false, these rules take precedence over the general-knowledge fallback above:
- Do NOT provide any pesticide, product, active ingredient, dose, application rate, PHI or REI.
- Do NOT provide treatment thresholds, scouting counts, crop-stage treatment rules, beneficial-insect advice, or any other agricultural guidance that is not explicitly present in the retrieved chunks.
- Do NOT use general model knowledge in pesticide-treatment questions.
- Answer with ONLY these elements: what the retrieved chunk explicitly says; a clear statement that actionable pesticide guidance is unavailable from the current retrieved evidence; a recommendation to verify current treatment with an official or current source; and optionally one simple follow-up question based only on facts already present in the retrieved context.

Strict limits at this stage:
- Do NOT give pesticide dosages, formulations or final pesticide recommendations. Never invent pesticide names, brands, active ingredients or restrictions. If the farmer asks for a spray or medicine, say that current pesticide and product guidance should be verified from an official or current source, and follow the pesticide-question rules above when retrieved context exists.
- Do NOT recommend organic, homemade or other non-chemical treatments either.
- You cannot see images and you have no weather data. Reason from the farmer's description, the farm details and any retrieved knowledge included in these instructions; when no retrieved knowledge is relevant, the general-guidance opening rule above applies.`;

/** How many of the most recent messages are sent to the model as context. */
const MAX_HISTORY_MESSAGES = 20;

/** How many knowledge chunks are retrieved to ground each assistant reply. */
const KNOWLEDGE_MATCH_COUNT = 5;

/**
 * Non-technical notice shown whenever an assistant reply cannot be produced.
 * Never includes upstream details — those stay in the server log.
 */
export const ASSISTANT_REPLY_FAILED =
  "Your message was saved, but the assistant could not reply right now. Please try again in a moment.";

export type AssistantReplyResult = { text: string } | { error: string };

/**
 * Generates the assistant reply for a consultation: system prompt + farm
 * context + retrieved knowledge + the recent conversation, sent to Gemini.
 * Returns a friendly error instead of throwing so the caller can keep the
 * saved user message.
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

  // Ground the reply: retrieve knowledge relevant to the latest user
  // message BEFORE calling Gemini. Best-effort by design — a retrieval
  // failure never breaks the chat, it just continues without context.
  const knowledge = await retrieveKnowledgeForReply(
    options.farm,
    options.history
  );

  try {
    const text = await generateGeminiText({
      systemInstruction: buildSystemInstruction(options.farm, knowledge),
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

/**
 * Combines the behavioural prompt with the selected farm's details and
 * any retrieved knowledge chunks.
 */
function buildSystemInstruction(
  farm: Farm,
  knowledge: MatchedKnowledgeChunk[] | null
): string {
  const lines: string[] = [`- Farm name: ${farm.name}`];
  lines.push(`- Location: ${farm.district} District, ${farm.tehsil} Tehsil`);
  lines.push(`- Area: ${farm.area} ${farm.area_unit ?? "acres"}`);
  lines.push(`- Crop: ${farm.crop}`);
  if (farm.variety) lines.push(`- Variety: ${farm.variety}`);
  if (farm.crop_stage) lines.push(`- Crop stage: ${farm.crop_stage}`);
  if (farm.irrigation) lines.push(`- Irrigation: ${farm.irrigation}`);
  if (farm.notes) lines.push(`- Farmer's notes: ${farm.notes}`);

  const sections = [
    SYSTEM_PROMPT,
    "Farm details (entered by the farmer — use as context):",
    lines.join("\n"),
  ];

  if (knowledge && knowledge.length > 0) {
    sections.push(buildKnowledgeSection(knowledge));
  }

  return sections.join("\n\n");
}

/**
 * Retrieves up to KNOWLEDGE_MATCH_COUNT knowledge chunks relevant to the
 * latest user message, filtered by the selected farm's crop when it is
 * set. Server-side only. Returns null when retrieval cannot run so the
 * reply continues without RAG context instead of failing the chat.
 */
async function retrieveKnowledgeForReply(
  farm: Farm,
  history: ConsultationMessage[]
): Promise<MatchedKnowledgeChunk[] | null> {
  const query = latestUserMessageText(history);
  if (!query) {
    return null;
  }

  try {
    // 768-dim Gemini embedding via the shared knowledge helper, then the
    // authenticated SECURITY DEFINER match_knowledge_chunks RPC.
    const embedding = await generateKnowledgeEmbedding(query);
    return await searchKnowledgeChunks({
      queryEmbedding: embedding,
      matchCount: KNOWLEDGE_MATCH_COUNT,
      crop: farm.crop.trim() || null,
    });
  } catch (err) {
    // Network, embedding-API or database failure: sanitized server-side
    // log only — continue without retrieved context and never fabricate
    // sources for the farmer.
    console.error(
      "Assistant knowledge retrieval failed (continuing without it):",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** Text of the most recent user message in the history (oldest first). */
function latestUserMessageText(history: ConsultationMessage[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i];
    if (message.role === "user") {
      return message.content?.trim() ?? "";
    }
  }
  return "";
}

/**
 * Compact context block of retrieved chunks for the system instruction.
 * Carries exactly the grounded-evidence fields — content, crop, problem
 * type, problem name, source page, verification status and
 * pesticide_actionable. Embeddings and similarity internals are never
 * included and must never reach the farmer. All current knowledge chunks
 * originate from the dealer training manual (the only ingested source),
 * so the block states that provenance.
 */
function buildKnowledgeSection(chunks: MatchedKnowledgeChunk[]): string {
  const entries = chunks.map((chunk, index) => {
    const meta = [
      `crop: ${chunk.crop ?? "unknown"}`,
      `problem_name: ${chunk.problem_name ?? "unknown"}`,
      `problem_type: ${chunk.problem_type ?? "unknown"}`,
      `source_page: ${chunk.source_page ?? "unknown"}`,
      `verification_status: ${chunk.verification_status ?? "unknown"}`,
      `pesticide_actionable: ${
        chunk.pesticide_actionable == null
          ? "unknown"
          : String(chunk.pesticide_actionable)
      }`,
    ].join(" | ");

    return `[${index + 1}] ${meta}\ncontent: ${chunk.content}`;
  });

  return [
    "Retrieved agricultural knowledge (from the dealer training manual — publisher unverified; manual-derived supporting information, not verified current guidance):",
    entries.join("\n\n"),
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
