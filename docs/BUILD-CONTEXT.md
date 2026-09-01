# ZarratAI Build Context

## Project

ZarratAI is a multilingual AI-powered agricultural decision-support platform for farmers in Punjab, Pakistan.

Core promise:

Describe the problem. Know what to do next.

This is a 3-day Alibaba Cloud hackathon MVP. Prioritize a working end-to-end vertical slice over feature breadth.

## Core Build Priority

1. Authentication
2. Create/select farm
3. Assistant
4. Text consultation
5. Image upload
6. Farm/context assembly
7. Agricultural knowledge retrieval
8. AI reasoning
9. Structured result
10. Confidence
11. Severity
12. Potential impact
13. Action plan
14. Verified pesticide information where supported
15. Follow-up
16. Farm History

Voice, weather, Farm Guide and calculators are secondary and must not delay the core flow.

## Product Rules

- Current product name is ZarratAI.
- Primary users are farmers in Punjab, Pakistan.
- Authentication decision: mobile number + password.
- Initial location: District + Tehsil.
- GPS is not required for V1.
- Organic/non-chemical treatment recommendations are excluded from the initial build.
- Chemical/pesticide information may only come from verified structured treatment data.
- Never invent pesticide names, brands, active ingredients, dosage, formulation or restrictions.
- API secrets must never be exposed in frontend code.
- Farm History remains stored until the user deletes it.
- AI/model-improvement consent is OFF by default and requires separate explicit opt-in.

## AI Architecture

Preferred flow:

User input
+ Farm context
+ Image findings
+ Relevant history
+ Weather when relevant
→ Knowledge retrieval
→ Relevant evidence
→ AI reasoning
→ Safety/confidence checks
→ Structured result
→ Natural-language response
→ Farm History

Core rule:

Retrieve evidence → reason over context → communicate uncertainty → recommend supported actions.

Do not implement unrestricted LLM answers as agricultural truth.

## AI Output

Prefer structured JSON.

Use qualitative confidence:

- High
- Medium
- Low

Use severity and impact:

- Low
- Moderate
- High
- Severe

Do not fabricate percentages.

If evidence is insufficient:

- ask one or two high-value questions
- request a clearer image when appropriate
- communicate uncertainty
- do not force a diagnosis
- do not provide unsupported pesticide treatment

## AI vs Deterministic Code

Use AI for:

- language understanding
- image interpretation
- contextual reasoning
- explanation
- follow-up questions
- natural-language generation

Use deterministic code for:

- calculations
- conversions
- database operations
- validation
- permissions
- structured filtering
- deletion
- account operations

## Knowledge Provenance

Source priority:

1. Official government/regulatory material
2. Verified agricultural reference material
3. Manufacturer documentation for product-specific facts
4. Dealer/company supplied information
5. Unverified material

Primary government source currently identified:

https://agripunjab.gov.pk/

Do not present private or commercial material as official government information.

## Frontend

- Mobile-first.
- Farmer-friendly.
- Assistant is the primary product interaction.
- Conversation should feel simple and familiar rather than like an enterprise dashboard.
- Preserve the agricultural/editorial design direction.
- Avoid generic AI SaaS styling.
- Avoid purple gradients, glowing AI effects, glassmorphism, fake statistics and excessive cards.

Design colors from the specification:

- Wheat Cream: #e5dccd
- Deep Moss: #103d26
- Forest Floor: #214534
- Olive Branch: #568037
- Harvest Copper: #ab5700
- Citron Beam: #e8e359

## Engineering Approach

Use a modular monolith for the hackathon.

Current foundation:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- ESLint
- src directory
- npm

Do not introduce microservices.

Do not add services, frameworks, packages, MCP servers or plugins unless required for a concrete feature.

Keep provider-specific AI integration behind internal abstractions where practical.

## Qoder Rules

Before implementing a task:

1. Read this file.
2. Modify only the files relevant to the task.
3. Do not perform speculative refactors.
4. Do not implement unrelated features.
5. Run validation after changes.
6. Report changed files and validation results.

Never attempt to build the entire ZarratAI application in one agent task.
