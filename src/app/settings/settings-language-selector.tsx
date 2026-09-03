"use client";

import { useState } from "react";

const LANGUAGE_KEY = "zarratai-language";

type Language = "en" | "ur";

const languages: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو (Urdu)" },
];

/** Reads the stored language from localStorage (client-side only). */
function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "ur") return stored;
  return "en";
}

export function SettingsLanguageSelector() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  function handleChange(value: Language) {
    setLanguage(value);
    localStorage.setItem(LANGUAGE_KEY, value);
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
