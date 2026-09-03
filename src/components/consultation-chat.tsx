"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  CameraIcon,
  CloseIcon,
  PhotoIcon,
  PlusIcon,
  SendIcon,
} from "@/components/icons";
import {
  sendMessage,
  startNewConsultation,
} from "@/app/actions/consultations";
import { IMAGE_SCAN_DEFAULT_CONTENT } from "@/lib/consultation-constants";
import type {
  Consultation,
  ConsultationMessage,
} from "@/lib/consultations";

/** A crop photo the farmer attached, downscaled in the browser. */
type AttachedImage = {
  mimeType: string;
  base64: string;
  /** Local preview data URL — never sent to the server. */
  previewUrl: string;
};

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
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [sending, startSendTransition] = useTransition();
  const [startingNew, startNewTransition] = useTransition();

  const bottomRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    const image = attachedImage;
    if ((!content && !image) || sending) return;

    // What the sent message shows: the caption when there is one, otherwise
    // a short label so an image scan reads clearly.
    const displayContent = image
      ? content || IMAGE_SCAN_DEFAULT_CONTENT
      : content;

    // Show the message optimistically while it is being saved.
    const tempId = `optimistic-${Date.now()}`;
    setError(null);
    setInput("");
    setAttachedImage(null);
    setOptimisticId(tempId);
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        consultation_id: consultation?.id ?? "",
        user_id: "",
        role: "user",
        input_type: image ? "image" : "text",
        content: displayContent,
        created_at: null,
      },
    ]);

    startSendTransition(async () => {
      const result = await sendMessage(
        content,
        image ? { mimeType: image.mimeType, base64: image.base64 } : undefined
      );
      const message = result.message;

      if (result.error || !message) {
        // Roll the optimistic message back so nothing is lost.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setOptimisticId(null);
        setInput(content);
        // Restore the photo so the farmer can simply retry.
        if (image) setAttachedImage(image);
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
    setAttachedImage(null);
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

  // Both the upload and the camera input land here. The camera input uses
  // capture="environment" so supporting devices open the rear camera
  // directly; other browsers fall back to the regular file picker.
  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file again re-triggers onChange.
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    resizePhoto(file)
      .then((image) => setAttachedImage(image))
      .catch(() =>
        setError("Could not read that photo. Please try another one.")
      );
  }

  /** Downscales the photo in the browser so the scan payload stays small. */
  async function resizePhoto(file: File): Promise<AttachedImage> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = dataUrl;
    });

    const maxDimension = 1280;
    let width = image.naturalWidth;
    let height = image.naturalHeight;
    if (width > height && width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas unavailable");
    }
    context.drawImage(image, 0, 0, width, height);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.75);
    const base64 = jpegDataUrl.slice(jpegDataUrl.indexOf(",") + 1);
    return { mimeType: "image/jpeg", base64, previewUrl: jpegDataUrl };
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
              changed. You can also attach or take a photo of the problem.
              Your messages are saved to this consultation.
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
        {/* Photo waiting to be scanned — local preview, removed before send */}
        {attachedImage && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-2 py-1.5">
            {/* Local preview only — the file itself is never uploaded to storage. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachedImage.previewUrl}
              alt="Photo ready to scan"
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-forest-floor/70">
              Photo ready to scan
            </span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-forest-floor/60 transition-colors hover:bg-forest-floor/10 hover:text-forest-floor focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citron-beam"
              aria-label="Remove photo"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-forest-floor/20 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-floor/60 transition-colors hover:bg-forest-floor/5 hover:text-forest-floor disabled:opacity-40 focus-visible:outline-citron-beam"
            aria-label="Upload a photo"
            title="Upload a photo"
          >
            <PhotoIcon />
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-floor/60 transition-colors hover:bg-forest-floor/5 hover:text-forest-floor disabled:opacity-40 focus-visible:outline-citron-beam"
            aria-label="Take a photo"
            title="Take a photo"
          >
            <CameraIcon />
          </button>
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
            disabled={sending || (input.trim().length === 0 && !attachedImage)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-harvest-copper text-wheat-cream transition-colors hover:bg-harvest-copper/90 disabled:opacity-40 focus-visible:outline-citron-beam"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>

        {/* Hidden pickers — triggered by the labelled buttons above. The
            camera input opens the rear camera on supporting devices. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
          aria-hidden="true"
          tabIndex={-1}
        />
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
        {isUser && message.input_type === "image" && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-wheat-cream/20 px-2 py-0.5 text-xs font-medium">
            <PhotoIcon size={12} />
            Photo
          </span>
        )}
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
