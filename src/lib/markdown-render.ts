import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Lightweight Markdown renderer for assistant messages.
 * Supports the subset Gemini commonly returns:
 * - **bold**
 * - Bullet lists (- or *)
 * - Numbered lists (1. 2. etc.)
 * - Paragraphs / line breaks
 *
 * Does NOT render arbitrary HTML, code blocks, tables, or links.
 * Returns React elements for safe rendering.
 */

type InlineNode = string | ReactNode;

/** Renders inline formatting: **bold** and *italic* */
function renderInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Match **bold** or *italic*
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      nodes.push(
        createElement(
          "strong",
          { key: `bold-${match.index}`, className: "font-semibold" },
          match[2]
        )
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        createElement(
          "em",
          { key: `italic-${match.index}` },
          match[3]
        )
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/**
 * Renders a small Markdown subset to React elements.
 * Used for assistant message content.
 */
export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let currentParagraph: string[] = [];
  let currentListType: "ul" | "ol" | null = null;
  let currentListItems: string[] = [];
  let blockKey = 0;

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join(" ").trim();
      if (content) {
        blocks.push(
          createElement(
            "p",
            { key: `p-${blockKey++}`, className: "mb-2 last:mb-0" },
            ...renderInline(content)
          )
        );
      }
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentListItems.length > 0 && currentListType) {
      const ListTag = currentListType;
      blocks.push(
        createElement(
          ListTag,
          {
            key: `list-${blockKey++}`,
            className:
              currentListType === "ul"
                ? "mb-2 ml-5 list-disc space-y-1 last:mb-0"
                : "mb-2 ml-5 list-decimal space-y-1 last:mb-0",
          },
          ...currentListItems.map((item, i) =>
            createElement(
              "li",
              { key: `li-${i}` },
              ...renderInline(item)
            )
          )
        )
      );
      currentListItems = [];
      currentListType = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line — end current block
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Bullet list item (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (currentListType !== "ul") {
        flushList();
        currentListType = "ul";
      }
      currentListItems.push(bulletMatch[1]);
      continue;
    }

    // Numbered list item (1. 2. etc.)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (currentListType !== "ol") {
        flushList();
        currentListType = "ol";
      }
      currentListItems.push(numberedMatch[1]);
      continue;
    }

    // Regular text — accumulate into paragraph
    flushList();
    currentParagraph.push(trimmed);
  }

  // Flush remaining content
  flushParagraph();
  flushList();

  if (blocks.length === 0) {
    return renderInline(text);
  }

  return createElement(Fragment, null, ...blocks);
}

/**
 * Strips Markdown formatting from text for speech synthesis.
 * Removes: **, *, #, backticks, and list markers.
 * Preserves the actual spoken words and useful punctuation.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove bold/italic markers
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.+?)\*/g, "$1");

  // Remove backticks (inline code)
  cleaned = cleaned.replace(/`(.+?)`/g, "$1");

  // Remove heading markers (# ## ###)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Remove bullet list markers (- or * at start of line)
  cleaned = cleaned.replace(/^[-*]\s+/gm, "");

  // Remove numbered list markers (1. 2. etc.)
  cleaned = cleaned.replace(/^\d+\.\s+/gm, "");

  // Collapse multiple newlines into single space for smoother speech
  cleaned = cleaned.replace(/\n+/g, " ");

  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned.trim();
}

/** A segment of text identified as Urdu or Latin/English for speech synthesis. */
export type LanguageSegment = {
  text: string;
  isUrdu: boolean;
};

/** Urdu/Arabic script Unicode ranges (used for language detection). */
const URDU_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Returns true when Urdu/Arabic-script text makes up a significant share of
 * the message — enough that the unreliable browser Urdu TTS matters and the
 * multilingual cloud voice is the better choice.
 *
 * Heuristic: at least 8 Urdu-script characters (a couple of words) and Urdu
 * characters are at least ~30% of all letters (Urdu + Latin combined).
 */
export function hasSignificantUrdu(text: string): boolean {
  if (!text) return false;

  const urduCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) ?? []).length;
  if (urduCount < 8) return false;

  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return urduCount >= latinCount * 0.3;
}

/**
 * Splits mixed Urdu/English text into ordered segments by script.
 * Urdu/Arabic script segments are marked isUrdu=true;
 * Latin/English segments are marked isUrdu=false.
 * Preserves the original order of text.
 */
export function splitLanguageSegments(text: string): LanguageSegment[] {
  if (!text) return [];

  const segments: LanguageSegment[] = [];

  // Split by sentences (period, question mark, exclamation mark followed by space or end)
  // This gives us natural breaks to switch languages
  const sentencePattern = /([^.!?]+[.!?]*)/g;
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(text)) !== null) {
    const sentence = match[1].trim();
    if (!sentence) continue;

    const isUrdu = URDU_SCRIPT_PATTERN.test(sentence);

    // Merge with previous segment if same language
    if (segments.length > 0 && segments[segments.length - 1].isUrdu === isUrdu) {
      segments[segments.length - 1].text += " " + sentence;
    } else {
      segments.push({ text: sentence, isUrdu });
    }
  }

  // If no sentences were found, treat the whole text as one segment
  if (segments.length === 0) {
    segments.push({
      text: text.trim(),
      isUrdu: URDU_SCRIPT_PATTERN.test(text),
    });
  }

  return segments;
}
