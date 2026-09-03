/**
 * Voice input for the assistant composer — a thin, client-safe wrapper
 * around the browser's Web Speech API (SpeechRecognition).
 *
 * No new dependency and no backend service: the browser performs the
 * recognition and hands us text, which simply lands in the composer for
 * the farmer to review before sending. TypeScript's lib.dom ships the
 * SpeechRecognition result types but not the recognizer itself, so the
 * minimal subset used here is declared.
 *
 * Privacy: ZarratAI never records, stores, or uploads audio. Only the
 * recognized text enters the consultation flow after the farmer sends it.
 */

/** Event delivered to SpeechRecognition.onresult (lib.dom omits it). */
export type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
};

/** Minimal SpeechRecognition subset the voice input relies on. */
export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

/**
 * Recognition languages, tried in order: Urdu (Pakistan) first for the
 * Punjab audience, English as the fallback for browsers without the
 * Urdu locale. When a language preference is added to the app, read it
 * here instead of the hardcoded order.
 */
export const SPEECH_LANGUAGES = ["ur-PK", "en-US"] as const;

/** Shown when the browser/device cannot do speech recognition at all. */
export const SPEECH_UNSUPPORTED_MESSAGE =
  "Voice input is not supported on this device/browser.";

/**
 * Returns the browser's SpeechRecognition constructor, or null when the
 * browser/device has no speech recognition support. Safe during SSR.
 */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}
