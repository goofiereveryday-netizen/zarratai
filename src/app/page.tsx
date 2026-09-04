import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChatIcon, FarmIcon, ScanIcon } from "@/components/icons";
import { WeatherCard } from "@/components/weather-card";
import { getSelectedFarm } from "@/lib/farms";
import { getCurrentUserProfile } from "@/lib/auth/profile";

export default async function Home() {
  const [selectedFarm, profile] = await Promise.all([
    getSelectedFarm(),
    getCurrentUserProfile(),
  ]);

  return (
    <AppShell userName={profile?.name}>
      <div className="mx-auto w-full max-w-3xl">
        {/* A. Selected Crop */}
        <section
          className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
          aria-label="Selected crop"
        >
          <div className="flex items-center gap-2 text-sm text-forest-floor">
            <FarmIcon />
            <span className="font-medium">Crop:</span>
            {selectedFarm ? (
              <span className="truncate font-medium text-deep-moss">
                {selectedFarm.name}
              </span>
            ) : (
              <span className="text-deep-moss/60">No crop selected</span>
            )}
            <Link
              href="/farms"
              className="ml-auto shrink-0 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
            >
              {selectedFarm ? "Change crop" : "Select crop"}
            </Link>
          </div>
          {selectedFarm && (
            <p className="mt-1 pl-7 text-sm text-forest-floor/70">
              {selectedFarm.area} acre{selectedFarm.area === 1 ? "" : "s"} ·{" "}
              {selectedFarm.crop}
              {selectedFarm.variety ? ` (${selectedFarm.variety})` : ""}
              {selectedFarm.crop_stage ? ` · ${selectedFarm.crop_stage}` : ""} ·{" "}
              {selectedFarm.district}, {selectedFarm.tehsil}
            </p>
          )}
        </section>

        {/* B. Today's Weather */}
        {selectedFarm && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
                Today&apos;s Weather
              </h2>
              <Link
                href="/weather"
                className="text-sm font-medium text-olive-branch underline-offset-2 hover:underline"
              >
                View weather →
              </Link>
            </div>
            <Suspense
              fallback={
                <div className="rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3">
                  <p className="text-sm text-forest-floor/60">
                    Loading weather…
                  </p>
                </div>
              }
            >
              <WeatherCard
                district={selectedFarm.district}
                tehsil={selectedFarm.tehsil}
                showForecastLink={false}
                showForecast={false}
              />
            </Suspense>
          </section>
        )}

        {/* C. Ask ZarratAI */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
            Ask ZarratAI
          </h2>
          <p className="mb-3 text-sm text-forest-floor/70">
            Describe a crop problem and get practical guidance.
          </p>
          <Link
            href="/assistant"
            className="group flex w-full items-center justify-center gap-3 rounded-xl bg-harvest-copper px-6 py-4 text-base font-semibold text-wheat-cream shadow-sm transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam md:max-w-md"
          >
            <ChatIcon />
            Start a conversation
          </Link>
        </section>

        {/* D. Crop Doctor */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
            Crop Doctor
          </h2>
          <p className="mb-3 text-sm text-forest-floor/70">
            Photograph a crop problem and ZarratAI will analyze what is visible
            in the photo.
          </p>
          <Link
            href="/assistant?scan=1"
            className="group flex w-full items-center justify-center gap-3 rounded-xl border-2 border-olive-branch px-6 py-4 text-base font-semibold text-olive-branch shadow-sm transition-colors hover:bg-olive-branch/5 focus-visible:outline-citron-beam md:max-w-md"
          >
            <ScanIcon />
            Scan crop
          </Link>
        </section>

        {/* E. My Crops */}
        <section className="mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
              My Crops
            </h2>
            <Link
              href="/farms/new"
              className="text-sm font-medium text-olive-branch underline-offset-2 hover:underline"
            >
              Add crop →
            </Link>
          </div>
          <p className="mt-1 text-sm text-forest-floor/70">
            {selectedFarm
              ? "Manage your crop records for better advice."
              : "Add your first crop to get started."}
          </p>
          <Link
            href="/farms"
            className="mt-3 inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
          >
            {selectedFarm ? "Manage crops →" : "Go to My Crops →"}
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
