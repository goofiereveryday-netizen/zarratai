import { AppShell } from "@/components/app-shell";
import { getSelectedFarm } from "@/lib/farms";
import Link from "next/link";

export default async function SettingsPage() {
  const selectedFarm = await getSelectedFarm();

  return (
    <AppShell>
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
          <div className="mt-3 space-y-2 text-sm text-forest-floor/80">
            <p>
              Signed in as{" "}
              <span className="font-medium text-forest-floor">
                {selectedFarm?.user_id ? "logged-in user" : "guest"}
              </span>
              .
            </p>
          </div>
        </section>

        {/* --- Selected farm ------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-sand bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-forest-floor/50">
            Selected farm
          </h2>
          {selectedFarm ? (
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
                Manage farms →
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-forest-floor/60">
              <p>No farm selected.</p>
              <Link
                href="/farms"
                className="inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
              >
                Go to My farms →
              </Link>
            </div>
          )}
        </section>

        {/* --- About ---------------------------------------------------- */}
        <section className="mt-4 rounded-2xl border border-sand bg-white p-5 shadow-sm">
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
