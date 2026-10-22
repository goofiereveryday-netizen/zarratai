import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getAuthenticatedSupabase,
  jsonResponse,
  optionsResponse,
} from "../_shared/http.ts";

const ASSISTANT_REPLY_FAILED =
  "Your message was saved, but the assistant could not reply right now. Please try again in a moment.";
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_ROWS = 100;
const KNOWLEDGE_MATCH_COUNT = 5;
const EMBEDDING_DIMENSIONS = 768;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PRIMARY_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const GEMINI_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT =
  `You are ZarratAI, an agricultural decision-support assistant for farmers in Punjab, Pakistan.

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

const IMAGE_SCAN_PROMPT =
  `You are ZarratAI's crop image analysis for farmers in Punjab, Pakistan. The farmer has sent a photo from their farm, and you may also see the recent conversation before it.

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

type Farm = {
  id: string;
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
};
type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | null;
  image_url: string | null;
  created_at: string;
};
type InlineImage = { mimeType: string; base64: string };
type GeminiTurn = { role: "user" | "model"; text: string; image?: InlineImage };
type MatchedChunk = {
  id: string;
  document_id: string | null;
  content: string;
  crop: string | null;
  problem_type: string | null;
  problem_name: string | null;
  source_page: number | null;
  verification_status: string | null;
  pesticide_actionable: boolean | null;
};
type DocumentMeta = {
  id: string;
  source_document: string;
  source_type: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
function isFarm(value: unknown): value is Farm {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.district === "string" && typeof value.tehsil === "string" &&
    typeof value.area === "number" && Number.isFinite(value.area) &&
    nullableString(value.area_unit) && typeof value.crop === "string" &&
    nullableString(value.variety) && nullableString(value.crop_stage) &&
    nullableString(value.irrigation) && nullableString(value.notes);
}
function isHistoryMessage(value: unknown): value is HistoryMessage {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    nullableString(value.content) && nullableString(value.image_url) &&
    typeof value.created_at === "string";
}
function isInlineImage(value: unknown): value is InlineImage {
  if (
    !isRecord(value) || typeof value.mimeType !== "string" ||
    typeof value.base64 !== "string"
  ) return false;
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
  if (
    !allowed.has(value.mimeType) || value.base64.length === 0 ||
    value.base64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8
  ) return false;
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value.base64) ||
    value.base64.length % 4 !== 0
  ) return false;
  try {
    return atob(value.base64).length <= MAX_IMAGE_BYTES;
  } catch {
    return false;
  }
}

function farmContext(farm: Farm): string {
  const lines = [
    `- Farm name: ${farm.name}`,
    `- Location: ${farm.district} District, ${farm.tehsil} Tehsil`,
    `- Area: ${farm.area} ${farm.area_unit ?? "acres"}`,
    `- Crop: ${farm.crop}`,
  ];
  if (farm.variety) lines.push(`- Variety: ${farm.variety}`);
  if (farm.crop_stage) lines.push(`- Crop stage: ${farm.crop_stage}`);
  if (farm.irrigation) lines.push(`- Irrigation: ${farm.irrigation}`);
  if (farm.notes) lines.push(`- Farmer's notes: ${farm.notes}`);
  return lines.join("\n");
}

function toGeminiTurns(history: HistoryMessage[]): GeminiTurn[] {
  const turns: GeminiTurn[] = [];
  for (const message of history) {
    const text = message.content?.trim();
    if (!text) continue;
    const role: GeminiTurn["role"] = message.role === "assistant"
      ? "model"
      : "user";
    const previous = turns.at(-1);
    if (previous?.role === role) previous.text = `${previous.text}\n\n${text}`;
    else turns.push({ role, text });
  }
  const recent = turns.slice(-MAX_HISTORY_MESSAGES);
  while (recent.length && recent[0].role === "model") recent.shift();
  return recent;
}
function latestUserText(history: HistoryMessage[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && history[i].content?.trim()) {
      return history[i].content!.trim();
    }
  }
  return "";
}

const CROP_ALIASES: readonly { crop: string; aliases: readonly string[] }[] = [
  { crop: "wheat", aliases: ["wheat", "gehun", "genhu"] },
  { crop: "rice", aliases: ["rice", "paddy", "chawal", "dhaan"] },
  { crop: "potato", aliases: ["potatoes", "potato", "aloo", "aaloo"] },
  { crop: "sugarcane", aliases: ["sugar cane", "sugarcane", "ganna"] },
  { crop: "cotton", aliases: ["cotton", "kapas"] },
  { crop: "maize", aliases: ["maize", "corn", "makai", "makka"] },
  { crop: "tomato", aliases: ["tomatoes", "tomato", "tamatar"] },
];
function detectCrop(text: string): string | null {
  for (const { crop, aliases } of CROP_ALIASES) {
    const sorted = [...aliases].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      sorted.map((alias) => `\\b${alias.replace(/\s+/g, "\\s+")}\\b`).join("|"),
      "i",
    );
    if (pattern.test(text)) return crop;
  }
  return null;
}

async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[]> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8_000) }] },
        output_dimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Embedding API returned ${response.status}.`);
  }
  const data = await response.json();
  const values = data?.embedding?.values;
  if (
    !Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS ||
    values.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v))
  ) {
    throw new Error("Embedding response had an invalid vector.");
  }
  return values as number[];
}

async function retrieveKnowledge(
  supabase: SupabaseClient,
  farm: Farm,
  history: HistoryMessage[],
  apiKey: string,
): Promise<{ chunks: MatchedChunk[] | null; documents: DocumentMeta[] }> {
  const query = latestUserText(history);
  if (!query) return { chunks: null, documents: [] };
  try {
    const crop = detectCrop(query) ?? (farm.crop.trim() || null);
    const embedding = await generateEmbedding(query, apiKey);
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: KNOWLEDGE_MATCH_COUNT,
      filter_crop: crop,
    });
    if (error) throw new Error(`Knowledge search RPC failed: ${error.message}`);
    const chunks = (Array.isArray(data) ? data : []).map((
      row: Record<string, unknown>,
    ): MatchedChunk => ({
      id: row.id == null ? "" : String(row.id),
      document_id: typeof row.document_id === "string" ? row.document_id : null,
      content: typeof row.content === "string" ? row.content : "",
      crop: typeof row.crop === "string" ? row.crop : null,
      problem_type: typeof row.problem_type === "string"
        ? row.problem_type
        : null,
      problem_name: typeof row.problem_name === "string"
        ? row.problem_name
        : null,
      source_page: typeof row.source_page === "number" ? row.source_page : null,
      verification_status: typeof row.verification_status === "string"
        ? row.verification_status
        : null,
      pesticide_actionable: typeof row.pesticide_actionable === "boolean"
        ? row.pesticide_actionable
        : null,
    }));
    const ids = [
      ...new Set(
        chunks.map((chunk) => chunk.document_id).filter((id): id is string =>
          Boolean(id)
        ),
      ),
    ];
    let documents: DocumentMeta[] = [];
    if (ids.length) {
      const { data: docs, error: docError } = await supabase.rpc(
        "get_knowledge_document_metadata",
        { document_ids: ids },
      );
      if (docError) {
        console.warn(
          "Knowledge source metadata lookup failed:",
          docError.message,
        );
      } else {documents = (Array.isArray(docs) ? docs : []).map((
          row: Record<string, unknown>,
        ) => ({
          id: typeof row.id === "string" ? row.id : "",
          source_document: typeof row.source_document === "string"
            ? row.source_document
            : "",
          source_type: typeof row.source_type === "string"
            ? row.source_type
            : "",
        })
        );}
    }
    return { chunks, documents };
  } catch (error) {
    console.error(
      "Assistant knowledge retrieval failed; continuing without RAG:",
      error instanceof Error ? error.message : "unknown",
    );
    return { chunks: null, documents: [] };
  }
}

function sourceLabel(
  doc: DocumentMeta | undefined,
  page: number | null,
): string {
  if (!doc) return page ? `page ${page}` : "retrieved source";
  const pagePart = page ? `, page ${page}` : "";
  switch (doc.source_type) {
    case "training_manual":
      return `dealer training manual${pagePart}`;
    case "government_report":
      return `${doc.source_document}${pagePart}`;
    case "manufacturer": {
      const year = doc.source_document.match(/\b(\d{4})\b/);
      return `${year ? `${year[1]} ` : ""}${doc.source_document}${pagePart}`;
    }
    case "safety_poster":
      return `${doc.source_document}${pagePart}`;
    default:
      return `${doc.source_document}${pagePart}`;
  }
}
function knowledgeSection(
  chunks: MatchedChunk[],
  documents: DocumentMeta[],
): string {
  const docMap = new Map(documents.map((doc) => [doc.id, doc]));
  const entries = chunks.map((chunk, index) => {
    const doc = chunk.document_id ? docMap.get(chunk.document_id) : undefined;
    const metadata = [
      `source: ${sourceLabel(doc, chunk.source_page)}`,
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
    return `[${index + 1}] ${metadata}\ncontent: ${chunk.content}`;
  });
  return `Retrieved agricultural knowledge (supporting evidence, not verified current guidance — attribute each chunk using its source label):\n\n${
    entries.join("\n\n")
  }`;
}

async function generateGeminiText(
  systemInstruction: string,
  turns: GeminiTurn[],
  apiKey: string,
): Promise<string> {
  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: turns.map((turn) => ({
      role: turn.role,
      parts: [
        ...(turn.text ? [{ text: turn.text }] : []),
        ...(turn.image
          ? [{
            inline_data: {
              mime_type: turn.image.mimeType,
              data: turn.image.base64,
            },
          }]
          : []),
      ],
    })),
  };
  const attempts = [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL];
  let lastStatus: string | number = "unknown";
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 750));
    const model = attempts[i];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        const upstreamBody = await response.text();
        console.error(
          `Gemini ${model} failed (${response.status}): ${
            upstreamBody.slice(0, 400)
          }`,
        );
        lastStatus = response.status;
        if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
        continue;
      }
      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((
        part: { text?: string },
      ) => part.text ?? "").join("").trim();
      if (text) return text;
      const finishReason = candidate?.finishReason ?? "unknown";
      console.error(`Gemini returned no text (finishReason: ${finishReason}).`);
      lastStatus = finishReason;
      if (
        ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(finishReason)
      ) break;
    } catch (error) {
      console.error(
        `Gemini ${model} request failed:`,
        error instanceof Error ? error.message : "unknown",
      );
      lastStatus = "network/timeout";
    }
  }
  throw new Error(
    `All Gemini generation attempts failed (${String(lastStatus)}).`,
  );
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabase>>;
  try {
    auth = await getAuthenticatedSupabase(request);
  } catch (error) {
    console.error(
      "Assistant Supabase configuration error:",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse({ error: "Service is not configured." }, 503);
  }
  if (!auth) return jsonResponse({ error: "Authentication required." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (
    !isRecord(body) || !isFarm(body.farm) || !Array.isArray(body.history) ||
    body.history.length > MAX_HISTORY_ROWS ||
    !body.history.every(isHistoryMessage)
  ) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  const farm = body.farm;
  const history = body.history as HistoryMessage[];
  let image: InlineImage | undefined;
  if (body.image !== undefined) {
    if (!isInlineImage(body.image)) {
      return jsonResponse({ error: "Invalid image payload." }, 400);
    }
    image = body.image;
  }
  if (
    history.reduce((sum, message) => sum + (message.content?.length ?? 0), 0) >
      100_000
  ) {
    return jsonResponse({ error: "Conversation history is too long." }, 413);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("GEMINI_API_KEY is not configured.");
    return jsonResponse({ error: ASSISTANT_REPLY_FAILED });
  }

  let turns = toGeminiTurns(history);
  if (image) {
    // The client sends the image separately from the saved history. Attach it to
    // the newest user turn, or create a short user turn when history has none.
    let userTurn: GeminiTurn | undefined;
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user") {
        userTurn = turns[i];
        break;
      }
    }
    if (!userTurn) {
      turns.push({ role: "user", text: "Please analyze this crop photo." });
    }
    userTurn = turns.at(-1)?.role === "user"
      ? turns.at(-1)
      : turns.findLast((turn) => turn.role === "user");
    if (userTurn) {
      if (!userTurn.text.trim()) {
        userTurn.text = "Please analyze this crop photo.";
      }
      userTurn.image = image;
    }
  }
  if (!turns.length || turns[0].role !== "user") {
    return jsonResponse({ error: ASSISTANT_REPLY_FAILED });
  }

  try {
    let systemInstruction: string;
    if (image) {
      systemInstruction = [
        IMAGE_SCAN_PROMPT,
        "Farm details (entered by the farmer — use as context):",
        farmContext(farm),
      ].join("\n\n");
    } else {
      const { chunks, documents } = await retrieveKnowledge(
        auth.supabase,
        farm,
        history,
        geminiKey,
      );
      const sections = [
        SYSTEM_PROMPT,
        "Farm details (entered by the farmer — use as context):",
        farmContext(farm),
      ];
      if (chunks?.length) sections.push(knowledgeSection(chunks, documents));
      systemInstruction = sections.join("\n\n");
    }
    const text = await generateGeminiText(systemInstruction, turns, geminiKey);
    return jsonResponse({ text });
  } catch (error) {
    console.error(
      "Failed to generate assistant reply:",
      error instanceof Error ? error.message : "unknown",
    );
    // Preserve the client helper's existing { text } | { error } result contract.
    return jsonResponse({ error: ASSISTANT_REPLY_FAILED });
  }
});
