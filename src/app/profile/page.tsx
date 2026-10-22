"use client";

import { useAuth } from "@/lib/supabase/auth-context";
import { AppShell } from "@/components/app-shell";
import { SettingsProfileEditor } from "@/app/settings/settings-profile-editor";
import Link from "next/link";

export default function ProfilePage() {
  const { user } = useAuth();
  const metadata = user?.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string" ? metadata.full_name : "";
  const phone =
    typeof metadata.phone_number === "string" ? metadata.phone_number : "";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-display font-semibold tracking-tight text-forest-floor">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-forest-floor/60">
            Your personal information.
          </p>
        </div>

        <section className="rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            Personal details
          </h2>
          <div className="mt-3">
            <SettingsProfileEditor initialName={name} initialPhone={phone} />
          </div>
        </section>

        <div className="mt-6">
          <Link
            href="/settings"
            className="text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
