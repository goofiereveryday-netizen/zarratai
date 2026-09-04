import type { Farm } from "@/lib/farms";
import type { ConsultationMessage } from "@/lib/consultations";
import {
  generateKnowledgeEmbedding,
  getKnowledgeDocumentsByIds,
  searchKnowledgeChunks,
  type KnowledgeDocumentMeta,
  type MatchedKnowledgeChunk,
} from "@/lib/knowledge/rag";
import {
  generateGeminiText,
  type GeminiImage,
  type GeminiTurn,
} from "./gemini";

/**
 * Behaviour rules for the consultation assistant. Retrieved knowledge
 * (RAG) from the knowledge layer is connected as supporting evidence; crop
 * photos run through the separate image-analysis path (analyzeCropImage).
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
- Each chunk carries a source label describing its origin — use that label when attributing information to the farmer.
- For government reports: name the report naturally (e.g. "According to the Final Rabi Estimates 2023-24 report…").
- For manufacturer materials: name the brochure naturally (e.g. "Based on the 2025 potato crop-program brochure…").
- For the dealer training manual: say "Based on the dealer training manual, page N…" — do NOT call it an official Government of Punjab publication.
- Attribute each piece of information using the source_label provided with each chunk (e.g. "Based on [source_label]…"). Never misattribute a source.
- NEVER use or mention internal metadata field names, status labels or flags in your reply to the farmer. Do NOT say phrases such as "requires current verification", "verification status", "publisher unverified", "pesticide_actionable", or "source_type". These are internal system fields — they must never appear in user-facing text.
- For non-pesticide questions: simply cite the source naturally and share the information. No disclaimers about verification status.
- When pesticide_actionable is false for a chunk, the chunk MUST NOT independently support actionable pesticide recommendations (no product names, doses, application rates, PHI or REI).
- If current verified pesticide evidence is unavailable, clearly say that current pesticide and product guidance should be verified from an official or current source.
- Do not invent or add scouting procedures, pest counting methods, economic thresholds, weather conditions, beneficial insect advice, crop-stage treatment rules, treatment timing, pesticide or fungicide names, active ingredients, rates or doses, or PHI/REI unless they are explicitly present in the retrieved context AND allowed by its pesticide_actionable value.
- When the retrieved evidence is insufficient for part of the question, say: "The retrieved sources do not contain enough information to answer that part safely." Then ask the farmer for relevant observations or recommend checking a current official source.
- If NO retrieved chunks are relevant at all, you may answer from general agricultural knowledge, but the whole answer must begin with: "General guidance — not from ZarratAI's retrieved sources:"

Pesticide and treatment questions — whenever retrieved chunks exist and their pesticide_actionable is false, these rules take precedence over the general-knowledge fallback above:
- Do NOT provide any pesticide, product, active ingredient, dose, application rate, PHI or REI.
- Do NOT provide treatment thresholds, scouting counts, crop-stage treatment rules, beneficial-insect advice, or any other agricultural guidance that is not explicitly present in the retrieved chunks.
- Do NOT use general model knowledge in pesticide-treatment questions.
- Answer with ONLY these elements: what the retrieved chunk explicitly says; a clear statement that actionable pesticide guidance is unavailable from the current retrieved evidence; a recommendation to verify current treatment with an official or current source; and optionally one simple follow-up question based only on facts already present in the retrieved context.

Strict limits at this stage:
- Do NOT give pesticide dosages, formulations or final pesticide recommendations. Never invent pesticide names, brands, active ingredients or restrictions. If the farmer asks for a spray or medicine, say that current pesticide and product guidance should be verified from an official or current source, and follow the pesticide-question rules above when retrieved context exists.
- Do NOT recommend organic, homemade or other non-chemical treatments either.
- You cannot see images and you have no weather data. Reason from the farmer's description, the farm details and any retrieved knowledge included in these instructions; when no retrieved knowledge is relevant, the general-guidance opening rule above applies.`;

/**
 * Behaviour rules for the crop-image analysis path. Kept deliberately
 * separate from SYSTEM_PROMPT: image scans have their own hard safety
 * rules and never touch retrieved knowledge (RAG is not involved).
 */
const IMAGE_SCAN_PROMPT = `You are ZarratAI's crop image analysis for farmers in Punjab, Pakistan. The farmer has sent a photo from their farm, and you may also see the recent conversation before it.

Your job:
- Look carefully at the photo and report ONLY what is actually visible in it.
- Give the likely visible issue(s) as possibilities, never as a confirmed diagnosis.
- Describe the visible symptoms you observe (for example leaf colour, spots, stripes, pattern, which parts of the plant are affected, how much of the plant is affected) — only what the photo actually shows.
- Use cautious wording throughout: "possible", "could be", "cannot be confirmed from the photo alone".
- Ask 1 to 3 short follow-up questions that would help narrow down the problem (for example how it started, how fast it is spreading, which plants are affected, recent irrigation or fertilizer).
- Suggest practical NON-CHEMICAL observations the farmer can make next (for example checking under the leaves, comparing new and old leaves, looking at nearby plants, checking the stem near the soil). Describe them as things to observe, never as treatments.

Hard safety rules:
- NEVER present an image-only diagnosis as confirmed. A photo alone cannot confirm a diagnosis.
- Do NOT diagnose from invisible facts: never state causes, pests, roots, soil or history that cannot be seen in the photo or read in the conversation.
- NEVER give pesticide or product names, brands, active ingredients, doses, application rates, PHI (pre-harvest interval), REI (re-entry interval) or registration claims based on the photo.
- If the farmer asks what pesticide or chemical to spray, say clearly that current pesticide and product guidance should be verified from an official or current source (for example the Agriculture Department of Punjab at agripunjab.gov.pk), and do NOT recommend any specific product or chemical treatment.
- If the photo is unclear, blurry, too dark, badly framed or does not clearly show a crop problem, say so plainly, do NOT guess, and briefly tell the farmer what a better photo would include (for example a close-up of the affected leaf, the whole plant, in daylight).
- If the crop in the photo clearly does not match the farm details provided, mention that difference briefly.

How to communicate:
- Reply in the language the farmer writes in (Urdu, Punjabi or English). If the farmer sent no text, use the language of the recent conversation, or English.
- Be concise and practical: short paragraphs or simple lists.
- Do not invent statistics, percentages or sources.

Structure the reply with these short labelled sections, in plain text:
What I can see:
Possible causes:
What is still unclear:
What to observe next:
Questions for you:`;

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
  const { chunks, documents } = await retrieveKnowledgeForReply(
    options.farm,
    options.history
  );

  try {
    const text = await generateGeminiText({
      systemInstruction: buildSystemInstruction(options.farm, chunks, documents),
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
 * Analyzes a crop photo the farmer just sent: image-scan system prompt +
 * farm context + the prior conversation, with the photo attached to the new
 * user turn. The image is used for this request only and never persisted.
 * Returns a friendly error instead of throwing so the caller can keep the
 * saved user message.
 */
export async function analyzeCropImage(options: {
  farm: Farm;
  /** Caption text sent with the photo (never empty — a default label is used). */
  caption: string;
  /** The photo to analyze, as inline base64. Server-side only. */
  image: GeminiImage;
  /** Conversation before the image message, oldest first. */
  history: ConsultationMessage[];
}): Promise<AssistantReplyResult> {
  const turns = toGeminiTurns(options.history);
  turns.push({ role: "user", text: options.caption, image: options.image });

  try {
    const text = await generateGeminiText({
      systemInstruction: [
        IMAGE_SCAN_PROMPT,
        "Farm details (entered by the farmer — use as context):",
        buildFarmContextLines(options.farm).join("\n"),
      ].join("\n\n"),
      turns,
    });
    return { text };
  } catch (err) {
    console.error(
      "Failed to analyze crop image:",
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
  chunks: MatchedKnowledgeChunk[] | null,
  documents: KnowledgeDocumentMeta[] | null
): string {
  const sections = [
    SYSTEM_PROMPT,
    "Farm details (entered by the farmer — use as context):",
    buildFarmContextLines(farm).join("\n"),
  ];

  if (chunks && chunks.length > 0) {
    sections.push(buildKnowledgeSection(chunks, documents ?? []));
  }

  return sections.join("\n\n");
}

/** Farm details as context lines, shared by the text and image-scan prompts. */
function buildFarmContextLines(farm: Farm): string[] {
  const lines: string[] = [`- Farm name: ${farm.name}`];
  lines.push(`- Location: ${farm.district} District, ${farm.tehsil} Tehsil`);
  lines.push(`- Area: ${farm.area} ${farm.area_unit ?? "acres"}`);
  lines.push(`- Crop: ${farm.crop}`);
  if (farm.variety) lines.push(`- Variety: ${farm.variety}`);
  if (farm.crop_stage) lines.push(`- Crop stage: ${farm.crop_stage}`);
  if (farm.irrigation) lines.push(`- Irrigation: ${farm.irrigation}`);
  if (farm.notes) lines.push(`- Farmer's notes: ${farm.notes}`);
  return lines;
}

/**
 * Supported crop names for deterministic mention detection.
 *
 * Each entry is one crop as stored in knowledge_chunks.crop, paired with
 * every alias a farmer might type. Longer aliases are tested first so
 * "sugarcane" matches before "cane". The matching regex uses word
 * boundaries and is case-insensitive, so "potato" in "my potato crop"
 * matches but "potatoe" does not.
 *
 * This is intentionally a simple keyword scanner — no AI call, no NLP
 * library. Extend the list when new crops are ingested.
 */
const CROP_DETECTION_ALIASES: readonly { crop: string; aliases: readonly string[] }[] = [
  { crop: "wheat", aliases: ["wheat", "gehun", "genhu"] },
  { crop: "rice", aliases: ["rice", "paddy", "chawal", "dhaan"] },
  { crop: "potato", aliases: ["potatoes", "potato", "aloo", "aaloo"] },
  { crop: "sugarcane", aliases: ["sugar cane", "sugarcane", "ganna"] },
  { crop: "cotton", aliases: ["cotton", "kapas"] },
  { crop: "maize", aliases: ["maize", "corn", "makai", "makka"] },
  { crop: "tomato", aliases: ["tomatoes", "tomato", "tamatar"] },
];

/**
 * Scans text for an explicitly mentioned crop. Returns the first match
 * (aliases are checked in declaration order — list the most specific or
 * most common crops first). Returns null when no known crop name is
 * found.
 */
function detectCropInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { crop, aliases } of CROP_DETECTION_ALIASES) {
    // Sort aliases longest-first so "sugar cane" beats "cane".
    const sorted = [...aliases].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      sorted.map((a) => `\\b${a.replace(/\s+/g, "\\s+")}\\b`).join("|"),
      "i",
    );
    if (pattern.test(lower)) {
      return crop;
    }
  }
  return null;
}

/**
 * Retrieves up to KNOWLEDGE_MATCH_COUNT knowledge chunks relevant to the
 * latest user message. The crop filter is resolved as follows:
 *
 *   1. If the user's latest message explicitly mentions a known crop
 *      (e.g. "potato", "sugarcane", "rice"), that crop is used.
 *   2. Otherwise the selected farm's crop is used (the current default).
 *
 * This lets the farmer ask about a different crop without changing
 * their selected farm. Server-side only. Returns null when retrieval
 * cannot run so the reply continues without RAG context instead of
 * failing the chat.
 */
async function retrieveKnowledgeForReply(
  farm: Farm,
  history: ConsultationMessage[]
): Promise<{
  chunks: MatchedKnowledgeChunk[] | null;
  documents: KnowledgeDocumentMeta[] | null;
}> {
  const query = latestUserMessageText(history);
  if (!query) {
    return { chunks: null, documents: null };
  }

  try {
    // Resolve the crop filter: explicit mention in the message takes
    // priority over the selected farm's crop.
    const mentionedCrop = detectCropInText(query);
    const retrievalCrop = mentionedCrop ?? (farm.crop.trim() || null);

    // 768-dim Gemini embedding via the shared knowledge helper, then the
    // authenticated SECURITY DEFINER match_knowledge_chunks RPC.
    const embedding = await generateKnowledgeEmbedding(query);
    const chunks = await searchKnowledgeChunks({
      queryEmbedding: embedding,
      matchCount: KNOWLEDGE_MATCH_COUNT,
      crop: retrievalCrop,
    });

    // Fetch document metadata for source attribution (best-effort —
    // a failure here degrades to generic attribution, never breaks
    // the chat).
    const documentIds = chunks
      .map((c) => c.document_id)
      .filter((id): id is string => id != null);
    const documents = documentIds.length > 0
      ? await getKnowledgeDocumentsByIds(documentIds)
      : [];

    return { chunks, documents };
  } catch (err) {
    // Network, embedding-API or database failure: sanitized server-side
    // log only — continue without retrieved context and never fabricate
    // sources for the farmer.
    console.error(
      "Assistant knowledge retrieval failed (continuing without it):",
      err instanceof Error ? err.message : err
    );
    return { chunks: null, documents: null };
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
 * Builds a human-readable source label from document metadata for
 * attribution in the knowledge section. Each source type gets a
 * distinct format so the model can correctly attribute answers.
 */
function buildSourceLabel(doc: KnowledgeDocumentMeta | undefined, sourcePage: number | null): string {
  if (!doc) {
    return sourcePage ? `page ${sourcePage}` : "retrieved source";
  }

  const page = sourcePage ? `, page ${sourcePage}` : "";

  switch (doc.source_type) {
    case "training_manual":
      return `dealer training manual${page}`;
    case "government_report":
      return `${doc.source_document}${page}`;
    case "manufacturer": {
      const date = doc.source_document.match(/\b(\d{4})\b/);
      const prefix = date ? `${date[1]} ` : "";
      return `${prefix}${doc.source_document}${page}`;
    }
    case "safety_poster":
      return `${doc.source_document}${page}`;
    default:
      return `${doc.source_document}${page}`;
  }
}

/**
 * Compact context block of retrieved chunks for the system instruction.
 * Each chunk carries a source_label derived from its parent document's
 * metadata so the model can correctly attribute information to the
 * actual source (training manual, government report, manufacturer
 * brochure, or safety poster). Embeddings and similarity internals are
 * never included.
 */
function buildKnowledgeSection(
  chunks: MatchedKnowledgeChunk[],
  documents: KnowledgeDocumentMeta[]
): string {
  const docMap = new Map(documents.map((d) => [d.id, d]));

  const entries = chunks.map((chunk, index) => {
    const doc = chunk.document_id ? docMap.get(chunk.document_id) : undefined;
    const sourceLabel = buildSourceLabel(doc, chunk.source_page);

    const meta = [
      `source: ${sourceLabel}`,
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
    "Retrieved agricultural knowledge (supporting evidence, not verified current guidance — attribute each chunk using its source label):",
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
