"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PlusIcon, SendIcon } from "@/components/icons";
import {
  sendMessage,
  startNewConsultation,
} from "@/app/actions/consultations";
import type {
  Consultation,
  ConsultationMessage,
} from "@/lib/consultations";

type ConsultationChatProps = {
  /** The active consultation for the selected farm, or null when none exists. */
  consultation: Consultation | null;
  /** Messages of the active consultation, oldest first. */
  messages: ConsultationMessage[];
};

export function ConsultationChat({
  consultation: initialConsultation,
  messages: initialMessages,
}: ConsultationChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [consultation, setConsultation] = useState(initialConsultation);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const [sending, startSendTransition] = useTransition();
  const [startingNew, startNewTransition] = useTransition();

  const bottomRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);

  // Keep the latest message visible: jump straight to the bottom on load,
  // then smooth-scroll as messages arrive.
  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({
      behavior: firstRenderRef.current ? "auto" : "smooth",
      block: "end",
    });
    firstRenderRef.current = false;
  }, [messages.length]);

  function submit() {
    const content = input.trim();
    if (!content || sending) return;

    // Show the message optimistically while it is being saved.
    const tempId = `optimistic-${Date.now()}`;
    setError(null);
    setInput("");
    setOptimisticId(tempId);
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        consultation_id: consultation?.id ?? "",
        user_id: "",
        role: "user",
        input_type: "text",
        content,
        created_at: null,
      },
    ]);

    startSendTransition(async () => {
      const result = await sendMessage(content);
      const message = result.message;

      if (result.error || !message) {
        // Roll the optimistic message back so nothing is lost.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setOptimisticId(null);
        setInput(content);
        setError(
          result.error ?? "Could not send the message. Please try again."
        );
        return;
      }

      setMessages((prev) => prev.map((m) => (m.id === tempId ? message : m)));
      setOptimisticId(null);
      if (result.consultation) {
        setConsultation(result.consultation);
      }

      const assistantMessage = result.assistantMessage;
      if (assistantMessage) {
        // The saved assistant reply — render it in the conversation.
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (result.assistantError) {
        // The user's message is saved in Supabase; only the reply failed.
        // Keep the message on screen and show a non-technical notice.
        setError(result.assistantError);
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  // Enter sends the message; Shift+Enter adds a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleNewConsultation() {
    setError(null);
    startNewTransition(async () => {
      const result = await startNewConsultation();
      if (result.error) {
        setError(result.error);
        return;
      }
      // The active consultation is completed — the next message starts a
      // separate consultation.
      setMessages([]);
      setConsultation(null);
    });
  }

  return (
    <section aria-label="Consultation">
      {consultation && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-deep-moss">
              {consultation.title ?? "Consultation"}
            </h2>
            <span className="inline-flex shrink-0 items-center rounded-full bg-olive-branch/10 px-2.5 py-0.5 text-xs font-medium text-olive-branch">
              Active
            </span>
          </div>
          <button
            type="button"
            onClick={handleNewConsultation}
            disabled={startingNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-forest-floor/20 px-3 py-2 text-sm font-medium text-forest-floor transition-colors hover:bg-forest-floor/5 disabled:opacity-50"
          >
            <PlusIcon />
            {startingNew ? "Starting..." : "New consultation"}
          </button>
        </div>
      )}

      {/* Conversation */}
      <div
        role="log"
        aria-label="Conversation"
        className="flex flex-col gap-3 pt-1"
      >
        {messages.length === 0 ? (
          <div className="rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-deep-moss">
              Describe the problem on your farm
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-forest-floor/70">
              Write what you are seeing — where it appears and how it has
              changed. Your messages are saved to this consultation.
            </p>
            <p className="mt-3 text-xs text-forest-floor/50">
              The assistant replies in the language you write in.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                pending={message.id === optimisticId}
              />
            ))}
            {/* Status while the server generates and saves the assistant
                reply — an honest indicator, never a fake reply. */}
            {sending && <AssistantReplyPending />}
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Composer — stays visible above the mobile bottom navigation */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-16 z-10 mt-3 bg-wheat-cream pb-2 pt-1 md:bottom-0 md:pb-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-forest-floor/20 bg-white p-2 shadow-sm">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe the problem…"
            aria-label="Message"
            className="max-h-32 min-h-10 w-full resize-none border-0 bg-transparent px-2 py-2 text-base text-deep-moss field-sizing-content placeholder-forest-floor/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-harvest-copper text-wheat-cream transition-colors hover:bg-harvest-copper/90 disabled:opacity-40 focus-visible:outline-citron-beam"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </form>

      {/* Scroll anchor — keeps the latest message and composer in view */}
      <div
        ref={bottomRef}
        aria-hidden="true"
        className="h-px scroll-mb-16 md:scroll-mb-4"
      />
    </section>
  );
}

function MessageBubble({
  message,
  pending,
}: {
  message: ConsultationMessage;
  pending: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
          isUser
            ? "rounded-tr-sm bg-harvest-copper text-wheat-cream"
            : "rounded-tl-sm border border-forest-floor/10 bg-wheat-cream-light text-deep-moss"
        } ${pending ? "opacity-60" : ""}`}
      >
        {message.content ?? ""}
      </div>
    </div>
  );
}

/** Shown while a sent message is waiting for its assistant reply. */
function AssistantReplyPending() {
  return (
    <div className="flex justify-start">
      <div
        className="animate-pulse rounded-2xl rounded-tl-sm border border-forest-floor/10 bg-wheat-cream-light px-4 py-2.5"
        role="status"
      >
        <p className="text-sm text-forest-floor/60">
          Assistant is preparing a reply…
        </p>
      </div>
    </div>
  );
}
