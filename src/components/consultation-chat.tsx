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
  MicIcon,
  PhotoIcon,
  PlusIcon,
  ScanIcon,
  SendIcon,
  SpeakerIcon,
  StopSpeakerIcon,
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
import {
  getSpeechRecognition,
  SPEECH_LANGUAGES,
  SPEECH_UNSUPPORTED_MESSAGE,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import {
  hasSignificantUrdu,
  renderMarkdown,
  splitLanguageSegments,
  stripMarkdown,
} from "@/lib/markdown-render";

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
  /** When true, show a prominent camera/photo action for crop scanning. */
  scanMode?: boolean;
};

export function ConsultationChat({
  consultation: initialConsultation,
  messages: initialMessages,
  scanMode = false,
}: ConsultationChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [consultation, setConsultation] = useState(initialConsultation);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [sending, startSendTransition] = useTransition();
  const [startingNew, startNewTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [urduSpeechUnavailable, setUrduSpeechUnavailable] = useState(false);
  // Browser TTS capability — starts false so the server render and the
  // first client render are identical; detected only after mount, so
  // the Read button appears post-hydration.
  const [speechSupported, setSpeechSupported] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Voice input bookkeeping: the composer text captured when listening
  // started, plus the transcript finalized so far. Interim results are
  // appended live so the farmer can review the text before sending.
  const speechBaseRef = useRef("");
  const speechFinalRef = useRef("");
  const speechLangIndexRef = useRef(0);
  const speechRetryRef = useRef(false);
  // Whether the farmer still intends to listen — a ref (not state) so
  // recognition callbacks always read the current intent across the
  // session restarts browsers force on long listening periods.
  const speechActiveRef = useRef(false);
  const speakingMessageIdRef = useRef<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Read-aloud playback: the <audio> element for ElevenLabs speech, its
  // object URL (revoked on stop/end so nothing lingers), and an abort
  // controller for the in-flight /api/tts request.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  // Detect browser speech-synthesis capability only after mount. The
  // initial render (server and first client paint) always treats it as
  // unsupported, so both trees match and hydration never mismatches. The
  // check runs in a timer callback — not synchronously in the effect
  // body — because a capability check needs the deferred setState pass.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSpeechSupported("speechSynthesis" in window);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

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

  // Scan mode: attempt to auto-activate camera input when the page loads.
  // Browsers may block this after navigation, so the prominent button is the
  // reliable fallback. We use a short delay to let the page fully render.
  useEffect(() => {
    if (!scanMode || !cameraInputRef.current) return;
    const timer = window.setTimeout(() => {
      cameraInputRef.current?.click();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [scanMode]);

  // End any live recognition and read-aloud playback when the chat unmounts.
  useEffect(() => {
    return () => {
      speechActiveRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // The browser tears down ended sessions on its own.
      }
      // Stop any active speech synthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Abort an in-flight TTS request and release the audio element and
      // its object URL — nothing is persisted or left playing.
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        try {
          audio.pause();
        } catch {
          // Already stopped.
        }
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  function submit() {
    const content = input.trim();
    const image = attachedImage;
    if ((!content && !image) || sending) return;
    // Never send mid-listening: stop the mic so the session ends cleanly.
    if (listening) stopListening();

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

  /**
   * Starts voice recognition and streams the transcript into the
   * composer. Recognition keeps running through normal speaking pauses;
   * the mic stops only when the farmer taps it again, presses Send, or
   * a fatal error occurs. When the browser ends a session early, it
   * restarts without losing or duplicating the transcript. The farmer
   * reviews and edits the text before sending — nothing is sent
   * automatically.
   */
  function startListening(restart = false) {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setSpeechNotice(SPEECH_UNSUPPORTED_MESSAGE);
      return;
    }

    if (restart) {
      // Continuation after the browser ended a session: fold what has
      // been recognized so far into the base text so the restarted
      // session appends instead of duplicating earlier words. Uses the
      // refs (always current), never the possibly-stale input closure.
      const recognized = speechFinalRef.current;
      if (recognized) {
        speechBaseRef.current = speechBaseRef.current
          ? `${speechBaseRef.current}${
              speechBaseRef.current.endsWith(" ") ? "" : " "
            }${recognized}`
          : recognized;
      }
    } else {
      // Fresh start: recognized speech appends to whatever the farmer
      // already typed.
      speechBaseRef.current = input
        ? input.endsWith(" ")
          ? input
          : `${input} `
        : "";
    }
    speechFinalRef.current = "";
    speechActiveRef.current = true;

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    // Urdu first for the Punjab audience; browsers without the Urdu
    // locale fall back to English (see onerror below).
    recognition.lang = SPEECH_LANGUAGES[speechLangIndexRef.current];
    // Keep listening through normal pauses. Browsers that still end
    // the session early are handled by the restart in onend below.
    recognition.continuous = true;
    recognition.interimResults = true; // live feedback in the composer

    recognition.onresult = (event) => {
      // Skip results from a session the farmer already stopped/replaced.
      if (recognitionRef.current !== recognition) return;
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }
      if (finalChunk) {
        speechFinalRef.current += finalChunk;
      }
      // Show everything recognized so the farmer can review before sending.
      setInput(
        `${speechBaseRef.current}${speechFinalRef.current}${interimChunk}`
      );
    };

    recognition.onerror = (event) => {
      if (
        event.error === "language-not-supported" &&
        speechLangIndexRef.current < SPEECH_LANGUAGES.length - 1
      ) {
        // Retry with English once this failed session has fully ended.
        speechRetryRef.current = true;
        return;
      }
      // Fatal errors stop the mic entirely; no-speech and aborted stay
      // silent so the restart in onend keeps the session alive.
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        speechActiveRef.current = false;
        setSpeechNotice("Microphone permission was denied.");
      } else if (event.error === "audio-capture") {
        speechActiveRef.current = false;
        setSpeechNotice("No microphone was found on this device.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        speechActiveRef.current = false;
        setSpeechNotice("Voice input stopped unexpectedly. Please try again.");
      }
    };

    recognition.onend = () => {
      // Skip when a newer session or a manual stop already took over.
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (speechRetryRef.current) {
        // Urdu is unavailable on this browser — the restart below
        // switches to English.
        speechRetryRef.current = false;
        speechLangIndexRef.current += 1;
      }
      if (speechActiveRef.current) {
        // The browser ended the session (time cap or silence) while the
        // farmer still intends to listen — restart shortly, giving the
        // browser a moment to release the microphone. A manual stop
        // during the gap wins because it clears speechActiveRef.
        window.setTimeout(() => {
          if (!speechActiveRef.current) {
            setListening(false);
            return;
          }
          startListening(true);
        }, 250);
        return;
      }
      setListening(false);
    };

    try {
      recognition.start();
      setSpeechNotice(null);
      setListening(true);
    } catch {
      // start() throws when another session is still winding down.
      speechActiveRef.current = false;
      setListening(false);
    }
  }

  /** Stops the active recognition; the transcript typed so far is kept. */
  function stopListening() {
    speechActiveRef.current = false;
    speechRetryRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      // The session already ended — nothing to stop.
    }
    setListening(false);
  }

  function handleMicClick() {
    if (listening) {
      stopListening();
      return;
    }
    startListening();
  }

  /** Pauses the playing audio element and revokes its object URL. */
  function releaseAudio() {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // Already stopped.
      }
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  /**
   * Stops everything read-aloud related: browser speech synthesis, an
   * in-flight ElevenLabs request, and any playing audio. Resets the
   * speaking state so the button flips back to "Read".
   */
  function stopAllSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    releaseAudio();
    speakingMessageIdRef.current = null;
    setSpeakingMessageId(null);
  }

  /**
   * Browser speech synthesis with sequential Urdu/English segments — used
   * for English-only answers and as the fallback when ElevenLabs fails.
   */
  function speakWithBrowser(
    message: ConsultationMessage,
    cleanedText: string
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    // Split into language segments (Urdu vs Latin/English)
    const segments = splitLanguageSegments(cleanedText);

    // Get available voices
    const voices = synth.getVoices();
    const urduVoice = voices.find((v) => v.lang.startsWith("ur"));
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));

    // Check if Urdu speech is needed but unavailable
    const hasUrduSegment = segments.some((s) => s.isUrdu);
    setUrduSpeechUnavailable(hasUrduSegment && !urduVoice);

    speakingMessageIdRef.current = message.id;
    setSpeakingMessageId(message.id);

    // Queue utterances sequentially
    let currentIndex = 0;

    function speakNext() {
      if (speakingMessageIdRef.current !== message.id) return; // stopped
      if (currentIndex >= segments.length) {
        // All segments finished
        speakingMessageIdRef.current = null;
        setSpeakingMessageId(null);
        return;
      }

      const segment = segments[currentIndex];
      currentIndex++;

      // Skip empty segments
      if (!segment.text.trim()) {
        speakNext();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);

      if (segment.isUrdu) {
        utterance.lang = "ur-PK";
        if (urduVoice) {
          utterance.voice = urduVoice;
        } else {
          // No Urdu voice available — skip this segment silently
          // (the notice is already shown)
          speakNext();
          return;
        }
      } else {
        utterance.lang = "en-US";
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      utterance.onend = () => speakNext();
      utterance.onerror = () => {
        // On error, try to continue with next segment
        speakNext();
      };

      synth.speak(utterance);
    }

    speakNext();
  }

  /**
   * Urdu-heavy answers: request audio from the authenticated /api/tts
   * endpoint (ElevenLabs multilingual voice) and play it in-browser.
   *
   * Lifecycle: IDLE -> (Read clicked) -> LOADING (request in flight,
   * button reads Stop) -> PLAYING (audio element active) -> IDLE only
   * when the audio naturally ends, the farmer clicks Stop, or a
   * confirmed failure occurs (then the browser fallback runs or the
   * notice is shown). Fetch completion alone never resets the button.
   */
  async function speakWithElevenLabs(
    message: ConsultationMessage,
    rawText: string
  ) {
    // LOADING — the button flips to "Stop" immediately so the farmer
    // can also cancel while the audio is still being fetched.
    speakingMessageIdRef.current = message.id;
    setSpeakingMessageId(message.id);
    setUrduSpeechUnavailable(false);

    const controller = new AbortController();
    ttsAbortRef.current = controller;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
        signal: controller.signal,
      });

      // Verify the response is actually audio before playing — a JSON
      // error body (even one with an OK status) must never reach the
      // <audio> element.
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("audio/")) {
        throw new Error("tts-unavailable");
      }

      // Stopped while the request was in flight — discard the audio.
      if (speakingMessageIdRef.current !== message.id) return;

      const blob = await response.blob();
      if (speakingMessageIdRef.current !== message.id) return;

      // PLAYING — the Audio object and its object URL stay in refs
      // until playback ends or is stopped; the URL is never revoked
      // before the audio finishes.
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      objectUrlRef.current = url;

      // Playback finished — clean up, revoke the URL, reset the button.
      // A stale onended from a previously replaced audio must never
      // release the newer one, so only the current audio acts.
      audio.onended = () => {
        if (audioRef.current !== audio) return;
        releaseAudio();
        if (speakingMessageIdRef.current === message.id) {
          speakingMessageIdRef.current = null;
          setSpeakingMessageId(null);
        }
      };
      // Playback error — clean up, then fall back to browser speech.
      // Same stale-callback guard as onended.
      audio.onerror = () => {
        if (audioRef.current !== audio) return;
        releaseAudio();
        if (speakingMessageIdRef.current === message.id) {
          speakWithBrowser(message, stripMarkdown(rawText));
        }
      };

      await audio.play();
    } catch {
      // Stop was requested while fetching — nothing further to do.
      if (speakingMessageIdRef.current !== message.id) return;

      // Confirmed TTS/playback failure — clean up, then fall back to
      // browser speech when an Urdu voice exists, otherwise show the
      // short notice and reset.
      releaseAudio();
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : null;
      const hasUrduVoice = synth
        ? synth.getVoices().some((v) => v.lang.startsWith("ur"))
        : false;
      if (hasUrduVoice) {
        speakWithBrowser(message, stripMarkdown(rawText));
        return;
      }
      speakingMessageIdRef.current = null;
      setSpeakingMessageId(null);
      setUrduSpeechUnavailable(true);
    } finally {
      if (ttsAbortRef.current === controller) {
        ttsAbortRef.current = null;
      }
    }
  }

  /**
   * Reads an assistant message aloud. Urdu-heavy answers use the
   * ElevenLabs multilingual voice via /api/tts (browser Urdu TTS is
   * unreliable on many devices); English-only answers keep browser
   * speech synthesis. Clicking the same message again stops the speech;
   * clicking a different message stops the current speech and starts
   * the new one.
   */
  async function handleToggleSpeak(message: ConsultationMessage) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // If this message is already speaking, stop it
    if (speakingMessageIdRef.current === message.id) {
      stopAllSpeech();
      setUrduSpeechUnavailable(false);
      return;
    }

    // Starting another answer stops the previous speech first.
    stopAllSpeech();

    const rawText = message.content ?? "";
    if (!rawText.trim()) return;

    // Strip markdown formatting before speech
    const cleanedText = stripMarkdown(rawText);

    if (hasSignificantUrdu(cleanedText)) {
      await speakWithElevenLabs(message, rawText);
      return;
    }

    speakWithBrowser(message, cleanedText);
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
        {/* Scan mode: prominent camera/photo action */}
        {scanMode && (
          <div className="rounded-xl border-2 border-olive-branch bg-olive-branch/5 px-6 py-5 text-center">
            <ScanIcon />
            <h3 className="mt-2 text-base font-semibold text-deep-moss">
              Scan your crop
            </h3>
            <p className="mt-1 text-sm text-forest-floor/70">
              Take a photo of the crop problem for analysis.
            </p>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-olive-branch px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-olive-branch/90 focus-visible:outline-citron-beam"
            >
              <CameraIcon />
              Take crop photo
            </button>
          </div>
        )}

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
                speaking={message.id === speakingMessageId}
                speechSupported={speechSupported}
                onToggleSpeak={() => handleToggleSpeak(message)}
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

      {speechNotice && (
        <p className="mt-2 text-xs text-forest-floor/60" role="status">
          {speechNotice}
        </p>
      )}

      {urduSpeechUnavailable && (
        <p className="mt-2 text-xs text-amber-700" role="status">
          Urdu read aloud is temporarily unavailable.
        </p>
      )}

      {/* Composer — stays visible above the mobile bottom navigation */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-16 z-10 mt-3 bg-wheat-cream pb-2 pt-1 md:bottom-0 md:pb-4"
      >
        {/* Live voice input — the transcript appears in the composer below. */}
        {listening && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-harvest-copper/40 bg-wheat-cream-light px-2 py-1.5 text-xs font-medium text-harvest-copper">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-harvest-copper opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-harvest-copper" />
            </span>
            Listening… speak now
          </div>
        )}

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
          <label
            htmlFor="crop-gallery-input"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-forest-floor/60 transition-colors hover:bg-forest-floor/5 hover:text-forest-floor focus-within:outline-citron-beam ${
              sending ? "pointer-events-none opacity-40" : ""
            }`}
            aria-label="Choose crop photo"
            title="Choose crop photo"
          >
            <PhotoIcon />
          </label>
          <label
            htmlFor="crop-camera-input"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-forest-floor/60 transition-colors hover:bg-forest-floor/5 hover:text-forest-floor focus-within:outline-citron-beam ${
              sending ? "pointer-events-none opacity-40" : ""
            }`}
            aria-label="Take crop photo"
            title="Take crop photo"
          >
            <CameraIcon />
          </label>
          <button
            type="button"
            onClick={handleMicClick}
            disabled={sending}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-citron-beam ${
              listening
                ? "bg-harvest-copper text-wheat-cream"
                : "text-forest-floor/60 hover:bg-forest-floor/5 hover:text-forest-floor"
            } disabled:opacity-40`}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            title={listening ? "Stop voice input" : "Start voice input"}
          >
            <MicIcon />
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

        {/* Native label/input activation — visually hidden (sr-only) so
            mobile browsers can still activate them through the labels above.
            display:none (Tailwind "hidden") prevents mobile activation. */}
        <input
          id="crop-gallery-input"
          type="file"
          accept="image/*"
          className="pointer-events-none sr-only"
          onChange={handleFileSelected}
          tabIndex={-1}
        />
        <input
          id="crop-camera-input"
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="pointer-events-none sr-only"
          onChange={handleFileSelected}
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
  speaking,
  speechSupported,
  onToggleSpeak,
}: {
  message: ConsultationMessage;
  pending: boolean;
  speaking: boolean;
  speechSupported: boolean;
  onToggleSpeak: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap rounded-tr-sm bg-harvest-copper text-wheat-cream"
            : "rounded-tl-sm border border-forest-floor/10 bg-wheat-cream-light text-deep-moss [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul:last-child]:mb-0 [&_ol]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol:last-child]:mb-0 [&_li]:pl-1"
        } ${pending ? "opacity-60" : ""}`}
      >
        {isUser && message.input_type === "image" && (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-wheat-cream/20 px-2 py-0.5 text-xs font-medium">
            <PhotoIcon size={12} />
            Photo
          </span>
        )}
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content ?? ""}</span>
        ) : (
          renderMarkdown(message.content ?? "")
        )}
        {!isUser && !pending && message.content && speechSupported && (
          <button
            type="button"
            onClick={onToggleSpeak}
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-citron-beam ${
              speaking
                ? "bg-olive-branch/20 text-olive-branch"
                : "bg-forest-floor/10 text-forest-floor/60 hover:bg-forest-floor/20 hover:text-forest-floor"
            }`}
            aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
            title={speaking ? "Stop reading aloud" : "Read aloud"}
          >
            {speaking ? <StopSpeakerIcon size={14} /> : <SpeakerIcon size={14} />}
            {speaking ? "Stop" : "Read"}
          </button>
        )}
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
