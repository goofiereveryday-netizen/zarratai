# ZarratAI

**AI-powered agricultural decision support for farmers in Punjab, Pakistan**

[Live Demo →](https://zarratai.vercel.app)

---

## The Problem

Smallholder farmers across Punjab face daily decisions about crop health, pest control, and treatment — often with limited access to verified, region-specific agricultural guidance. Misinformation and unverified pesticide advice can lead to crop loss, unnecessary chemical use, and serious health and environmental risks. Traditional extension services are stretched thin, and most digital agriculture tools do not speak the farmer's language — literally or practically.

## The Solution

ZarratAI is a decision-support assistant that combines a retrieval-augmented knowledge base with Google's Gemini models to give farmers clear, practical, and source-attributed guidance. The system is grounded in curated Punjab agricultural knowledge — it uses retrieval-augmented generation, source attribution, and safety rules to reduce unsupported diagnoses and unverified pesticide recommendations, and tells the farmer where each piece of advice came from.

## Target Users

- Smallholder and mid-scale farmers in Punjab, Pakistan
- Agricultural extension officers seeking a digital assistant

## Key Features

| Feature | Description |
|---|---|
| **Farm & Crop Context** | Farmers register fields with crop, location, and size — the assistant uses this to tailor advice |
| **Gemini AI Assistant** | Conversational agricultural guidance powered by Google Gemini with automatic fallback |
| **RAG Knowledge Retrieval** | Semantic search over curated Punjab agricultural knowledge (training manuals, government reports, manufacturer docs) |
| **Image & Camera Analysis** | Upload or capture crop photos for cautious visual analysis — no confirmed diagnosis is provided |
| **Voice Input** | Speak questions hands-free using the browser's Web Speech API |
| **Read-Aloud (TTS)** | Responses read aloud in Urdu via ElevenLabs or English via browser TTS |
| **Weather** | Real-time conditions and forecasts from Open-Meteo, displayed per farm |
| **Consultation History** | Full persistent record of every conversation, accessible for review |

## Responsible AI & Pesticide Safety

ZarratAI is designed to **never provide unverified actionable pesticide guidance**. This is the single most important safety constraint in the system:

- **Reduces speculative diagnoses.** When evidence is insufficient, the assistant says so clearly instead of guessing.
- **No unverified pesticide recommendations.** Unless the retrieved knowledge explicitly supports an actionable recommendation — verified at the database tier with strict registration and verification gates — the model will not name pesticides, dosages, rates, PHI, or REI values.
- **Source provenance on every claim.** Each piece of retrieved knowledge is attributed to its source (e.g., "Punjab Agriculture Department crop advisory", "dealer training manual, page 12") so the farmer knows where the advice came from.
- **Source hierarchy.** When multiple sources disagree or overlap, the system prioritises: (1) Punjab Agriculture Department, (2) manufacturer/label, (3) government training manuals, (4) commercial catalog.
- **Hard grounding rule.** When retrieved chunks are provided, the assistant uses **only** facts from those chunks — no general-knowledge supplementation. When no chunks are relevant, the model begins with "General guidance — not from ZarratAI's retrieved sources:".
- **Image analysis safety.** Crop photos are analyzed cautiously: what is visible, possible causes, what is unclear, what to observe next. No pesticide names, doses, or treatment instructions are derived from a photo.

### Pesticide Verification Gates

An actionable pesticide recommendation is only permitted when **all** of the following are satisfied at the knowledge layer:

1. Source tier ≤ 2 (Punjab government or manufacturer only)
2. Verification status is `verified_current`
3. Active ingredient, application rate, target crop, and problem are specified
4. Registration status is `confirmed_current`
5. PHI and REI statuses are not unverified

These gates are enforced in the knowledge layer — the LLM cannot override them.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (React)                       │
│   Chat UI · Voice Input · Camera · Read-Aloud · Farm Forms  │
└──────────────────────────┬──────────────────────────────────┘
                           │
              Next.js Server Actions / Route Handlers
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
   │  Gemini   │   │   Supabase  │   │  ElevenLabs │
   │  (text +  │   │  (Auth +    │   │   (TTS)     │
   │  vision)  │   │   pgvector) │   │             │
   └───────────┘   └─────────────┘   └─────────────┘
         │                 │
    ┌────▼────┐     ┌──────▼──────┐
    │ Open-   │     │  RAG:       │
    │ Meteo   │     │  knowledge_ │
    │(weather)│     │  chunks +   │
    └─────────┘     │  embeddings │
                    └─────────────┘
```

- **Transport layer** — `gemini.ts` handles API calls (text + inline image parts), timeouts, retries, and sanitised error propagation.
- **Prompt layer** — `assistant.ts` injects farm context, retrieved knowledge (with per-chunk source labels), and conversation history while enforcing behavioural constraints.
- **Orchestration layer** — Server actions persist the user message **first** (persistence-first design), then generate and persist the AI reply.
- **UI layer** — Renders real replies, read-aloud, photo attach/capture, and non-technical failure messages.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router) |
| Language | **TypeScript** |
| AI Generation | **Google Gemini** (`gemini-3.5-flash` primary, `gemini-3.5-flash-lite` fallback) |
| AI Embeddings | **Google Gemini Embedding** (`gemini-embedding-2`, 768 dimensions) |
| Database | **Supabase** (PostgreSQL + `pgvector` extension) |
| Auth | **Supabase Auth** (phone + password) |
| Hosting | **Vercel** |
| Text-to-Speech | **ElevenLabs** (Urdu voices) + Web Speech API (English fallback) |
| Weather | **Open-Meteo** (free, no API key) |
| Styling | **Tailwind CSS v4** |

## Knowledge Retrieval (RAG)

ZarratAI uses a retrieval-augmented generation pipeline to ground every agricultural response in verified sources:

1. **Embedding** — When the farmer sends a message, the latest user text is embedded server-side using Gemini's `gemini-embedding-2` model (768 dimensions).
2. **Semantic Search** — The embedding is used to find up to 5 semantically similar chunks from the `knowledge_chunks` table via the `match_knowledge_chunks` RPC, filtered by the selected farm's crop.
3. **Source Attribution** — Document metadata is fetched via a separate `get_knowledge_document_metadata` RPC to build human-readable source labels (e.g., "Punjab Agriculture Department crop advisory, page 12").
4. **Context Injection** — Chunks are injected into the system instruction as a compact retrieval block with source labels, content, crop, problem type, and verification flags — **no raw embeddings or similarity scores** are exposed to the model.
5. **Grounded Generation** — Gemini generates the response using **only** the retrieved facts when chunks are relevant, with per-source-type attribution rules.

The knowledge base is seeded through dev-only ingestion routes with `NODE_ENV` guards (refuse to run in production) and a double-gated security model.

## Security & Privacy

- **Server-side credentials.** API keys (Gemini, ElevenLabs, Supabase service role) are read exclusively from the server environment — they are never exposed to the client bundle.
- **Protected RAG tables.** The raw `knowledge_chunks` and `knowledge_documents` tables are protected from direct client access — semantic retrieval flows through a restricted `SECURITY DEFINER` RPC granted only to authenticated users, with a locked-down `search_path`.
- **Authentication.** Phone-number-based auth via Supabase with no real email collection. Farmer profile data (name, phone) stored in user metadata — no additional PII tables.
- **No image persistence.** Crop photos are processed in-memory for the single request only — they are never stored or uploaded to external storage.
- **Sanitised error handling.** Upstream API errors are reduced to short, safe tokens before reaching the client. Raw error bodies, stack traces, and request headers are never returned.
- **Persistence-first.** User messages are persisted to the database **before** AI generation, so no farmer input is lost even if the model call fails.

## Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- A [Supabase](https://supabase.com) project with the `pgvector` extension enabled
- A [Google AI Studio](https://aistudio.google.com) API key for Gemini
- An [ElevenLabs](https://elevenlabs.io) API key (optional — TTS falls back to browser speech)
- The RAG security SQL applied to your Supabase database (see `docs/sql/rag-security.sql`)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/zarratai.git
   cd zarratai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the project root with the variables listed below.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file with the following variable **names**. All values must be obtained from their respective service providers — **never commit this file**.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/publishable key |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini generation and embeddings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, development/knowledge-ingestion only**; never exposed to the client bundle |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for Urdu text-to-speech (optional) |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID for TTS (optional) |

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` and all other secret keys must remain server-side. Only variables prefixed with `NEXT_PUBLIC_` are exposed to the client bundle. Never commit `.env.local` to version control.

## Deployment

The project is deployed on [Vercel](https://vercel.com). To deploy your own instance:

```bash
npx vercel --prod
```

Set all environment variables in your Vercel project settings before deploying.

---

**Live demo:** [https://zarratai.vercel.app](https://zarratai.vercel.app)
