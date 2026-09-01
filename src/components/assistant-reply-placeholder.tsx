/**
 * Temporary development placeholder shown in place of an assistant reply.
 *
 * This is NOT an AI response and must never look like agricultural advice —
 * it only confirms that the user's message was saved. The AI orchestration
 * layer will replace this component later; until then it is the single
 * rendering point for the assistant side of the conversation.
 */
export function AssistantReplyPlaceholder() {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] rounded-2xl rounded-tl-sm border border-dashed border-forest-floor/30 bg-wheat-cream-light px-4 py-3"
        role="status"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-forest-floor/50">
          Development state — not an AI reply
        </p>
        <p className="mt-1 text-sm leading-relaxed text-forest-floor/80">
          Message saved. AI analysis will be connected next.
        </p>
      </div>
    </div>
  );
}
