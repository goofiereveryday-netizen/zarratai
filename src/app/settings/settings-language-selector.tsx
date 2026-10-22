"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  getLocalPreference,
  OFFLINE_DATA_CHANGED_EVENT,
  saveLocalPreference,
} from "@/lib/offline/database";
import { isNetworkAvailable } from "@/lib/offline/identity";
import { syncUserData } from "@/lib/offline/sync";

type Language = "en" | "ur";
const LEGACY_LANGUAGE_KEY = "zarratai-language";
const languages: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو (Urdu)" },
];

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ur";
}

function readSavedLanguage(userId?: string): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = userId
      ? localStorage.getItem(`${LEGACY_LANGUAGE_KEY}:${userId}`) ??
        localStorage.getItem(LEGACY_LANGUAGE_KEY)
      : localStorage.getItem(LEGACY_LANGUAGE_KEY);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

export function SettingsLanguageSelector() {
  const { user } = useAuth();
  const userId = user?.id;
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    let cancelled = false;
    const loadLanguage = async () => {
      const fallback = readSavedLanguage(userId);
      if (!userId) {
        if (!cancelled) setLanguage(fallback);
        return;
      }
      try {
        let saved = await getLocalPreference<Language>(userId, "language");
        let mayMigrate = !saved && isNetworkAvailable();
        if (mayMigrate) {
          const syncResult = await syncUserData(userId);
          mayMigrate = !syncResult.error;
          saved = await getLocalPreference<Language>(userId, "language");
        }
        if (cancelled) return;
        if (isLanguage(saved)) {
          setLanguage(saved);
        } else {
          setLanguage(fallback);
          if (mayMigrate) {
            void saveLocalPreference(userId, "language", fallback).catch((error) => {
              console.warn("Could not migrate the saved language preference:", error);
            });
          }
        }
      } catch {
        if (!cancelled) setLanguage(fallback);
      }
    };

    void loadLanguage();
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, loadLanguage);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, loadLanguage);
    };
  }, [userId]);

  function handleChange(value: Language) {
    setLanguage(value);
    try {
      localStorage.setItem(
        userId ? `${LEGACY_LANGUAGE_KEY}:${userId}` : LEGACY_LANGUAGE_KEY,
        value,
      );
    } catch {
      // IndexedDB remains the preferred persistent store when available.
    }
    if (userId) {
      void saveLocalPreference(userId, "language", value).catch((error) => {
        console.warn("Could not save the language preference locally:", error);
      });
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.value}
          type="button"
          onClick={() => handleChange(lang.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            language === lang.value
              ? "bg-olive-branch text-wheat-cream"
              : "border border-forest-floor/20 text-forest-floor hover:bg-forest-floor/5"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
