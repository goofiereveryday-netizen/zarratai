import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChatIcon, FarmIcon } from "@/components/icons";
import { getSelectedFarm } from "@/lib/farms";

export default async function Home() {
  const selectedFarm = await getSelectedFarm();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        {/* Selected farm */}
        <section
          className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
          aria-label="Selected farm"
        >
          <div className="flex items-center gap-2 text-sm text-forest-floor">
            <FarmIcon />
            <span className="font-medium">Farm:</span>
            {selectedFarm ? (
              <span className="truncate font-medium text-deep-moss">
                {selectedFarm.name}
              </span>
            ) : (
              <span className="text-deep-moss/60">No farm selected</span>
            )}
            <Link
              href="/farms"
              className="ml-auto shrink-0 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
            >
              {selectedFarm ? "Change farm" : "Select farm"}
            </Link>
          </div>
          {selectedFarm && (
            <p className="mt-1 pl-7 text-sm text-forest-floor/70">
              {selectedFarm.area} acre{selectedFarm.area === 1 ? "" : "s"} ·{" "}
              {selectedFarm.crop}
              {selectedFarm.variety ? ` (${selectedFarm.variety})` : ""} ·{" "}
              {selectedFarm.district}, {selectedFarm.tehsil}
            </p>
          )}
        </section>

        {/* Primary action: Ask ZarratAI */}
        <section className="mb-8 text-center md:text-left">
          <h1 className="text-2xl font-bold tracking-tight text-deep-moss md:text-3xl">
            Ask ZarratAI
          </h1>
          <p className="mt-2 text-base text-forest-floor/80 leading-relaxed max-w-lg">
            Describe the problem. Know what to do next.
          </p>
        </section>

        {/* Assistant CTA */}
        <section className="mb-10">
          <Link
            href="#assistant"
            className="group flex w-full items-center justify-center gap-3 rounded-xl bg-harvest-copper px-6 py-5 text-lg font-semibold text-wheat-cream shadow-sm transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam md:max-w-md"
          >
            <ChatIcon />
            Start a conversation
          </Link>
        </section>

        {/* Quick info */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
            What you can ask about
          </h2>
          <ul className="space-y-2 text-base text-forest-floor">
            <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                1
              </span>
              <span>Crop diseases and pest problems</span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                2
              </span>
              <span>Verified pesticide information</span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                3
              </span>
              <span>Farm management advice</span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
