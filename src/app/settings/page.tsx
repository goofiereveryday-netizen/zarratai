"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsProfileEditor } from "./settings-profile-editor";
import { SettingsLanguageSelector } from "./settings-language-selector";
import { LogoutButton } from "@/components/logout-button";
import { getSelectedFarm, type Farm } from "@/lib/farms";
import { useAuth } from "@/lib/supabase/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSelectedFarm().then((farm) => {
      setSelectedFarm(farm);
      setLoading(false);
    });
  }, []);

  const userName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  const phone =
    typeof user?.user_metadata?.phone_number === "string"
      ? user.user_metadata.phone_number
      : "";

  return (
    <AppShell userName={userName}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-display font-semibold tracking-tight text-forest-floor">
            Settings
          </h1>
          <p className="mt-1 text-sm text-forest-floor/60">
            Your account and app preferences.
          </p>
        </div>

        {/* --- Account -------------------------------------------------- */}
        <section className="rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            Account
          </h2>
          <div className="mt-3 space-y-4">
            <SettingsProfileEditor
              initialName={userName ?? ""}
              initialPhone={phone}
            />
            <div className="border-t border-sand pt-4">
              <LogoutButton className="rounded-lg border border-forest-floor/20 px-4 py-2 text-sm font-medium text-forest-floor transition-colors hover:bg-forest-floor/5" />
            </div>
          </div>
        </section>

        {/* --- Selected crop ------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            Crop
          </h2>
          {loading ? (
            <div className="mt-3 text-sm text-forest-floor/60">Loading…</div>
          ) : selectedFarm ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-forest-floor">
                {selectedFarm.name}
              </p>
              <p className="text-forest-floor/60">
                {selectedFarm.district}
                {selectedFarm.tehsil ? ` · ${selectedFarm.tehsil}` : ""}
                {selectedFarm.crop ? ` · ${selectedFarm.crop}` : ""}
              </p>
              <Link
                href="/farms"
                className="mt-3 inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
              >
                Manage crops →
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-forest-floor/60">
              <p>No crop selected.</p>
              <Link
                href="/farms"
                className="inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
              >
                Go to My Crops →
              </Link>
            </div>
          )}
        </section>

        {/* --- Language ------------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            Language
          </h2>
          <p className="mt-2 text-sm text-forest-floor/60">
            Choose your preferred language for the interface.
          </p>
          <SettingsLanguageSelector />
        </section>

        {/* --- History -------------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            History
          </h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link
              href="/history"
              className="inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
            >
              View Farm History →
            </Link>
            <p className="text-forest-floor/60">
              Your conversation history is stored with your account.
            </p>
          </div>
        </section>

        {/* --- About ---------------------------------------------------- */}
        <section className="mt-4 mb-8 rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            About
          </h2>
          <p className="mt-3 text-sm text-forest-floor/70">
            ZarratAI helps farmers in Punjab make practical crop decisions
            using AI-assisted analysis and local agricultural context.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
