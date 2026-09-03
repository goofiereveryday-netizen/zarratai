import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FarmIcon } from "@/components/icons";
import { WeatherCard } from "@/components/weather-card";
import { getSelectedFarm } from "@/lib/farms";
import { getCurrentUserProfile } from "@/lib/auth/profile";

/**
 * Weather page — shows current conditions and the short forecast for the
 * currently selected crop's location.
 */
export default async function WeatherPage() {
  const [selectedFarm, profile] = await Promise.all([
    getSelectedFarm(),
    getCurrentUserProfile(),
  ]);

  return (
    <AppShell userName={profile?.name}>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
          Weather
        </h1>
        <p className="mt-1 text-sm text-forest-floor/70">
          Current conditions and the short forecast for your selected crop.
        </p>

        {!selectedFarm ? (
          <section className="mt-6 rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-branch/10 text-olive-branch">
              <FarmIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-deep-moss">
              No crop selected
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-forest-floor/70">
              Select a crop to see current weather and the short forecast for
              its location.
            </p>
            <Link
              href="/farms"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
            >
              Select a crop
            </Link>
          </section>
        ) : (
          <>
            <section
              className="mt-6 mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
              aria-label="Selected crop"
            >
              <div className="flex items-center gap-2 text-sm text-forest-floor">
                <FarmIcon />
                <span className="font-medium">Crop:</span>
                <span className="truncate font-medium text-deep-moss">
                  {selectedFarm.name}
                </span>
                <Link
                  href="/farms"
                  className="ml-auto shrink-0 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
                >
                  Change crop
                </Link>
              </div>
              <p className="mt-1 pl-7 text-sm text-forest-floor/70">
                {selectedFarm.district}, {selectedFarm.tehsil}
              </p>
            </section>

            <Suspense
              fallback={
                <div className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3">
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
              />
            </Suspense>
          </>
        )}
      </div>
    </AppShell>
  );
}
