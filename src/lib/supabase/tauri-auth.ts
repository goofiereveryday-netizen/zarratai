export const TAURI_AUTH_STORAGE_KEY = "zarratai-tauri-auth";

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  return Boolean(
    tauriWindow.__TAURI_INTERNALS__ ||
      window.location.protocol === "tauri:" ||
      window.location.hostname === "tauri.localhost",
  );
}

export function getTauriAuthStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("Tauri auth storage is only available in a WebView.");
  }
  return window.localStorage;
}
