import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FarmCard } from "@/components/farm-card";
import { FarmIcon, PlusIcon } from "@/components/icons";
import { getFarms } from "@/lib/farms";

export default async function FarmsPage() {
  const farms = await getFarms();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
              My Farms
            </h1>
            <p className="mt-1 text-sm text-forest-floor/70">
              Select the farm ZarratAI uses for advice.
            </p>
          </div>
          {farms.length > 0 && (
            <Link
              href="/farms/new"
              className="inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-4 py-2.5 text-sm font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
            >
              <PlusIcon />
              Add farm
            </Link>
          )}
        </div>

        {farms.length === 0 ? (
          <section className="rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-branch/10 text-olive-branch">
              <FarmIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-deep-moss">
              No farms yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-forest-floor/70">
              Add your farm details so ZarratAI can give advice for your exact
              crop and location.
            </p>
            <Link
              href="/farms/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
            >
              <PlusIcon />
              Add your first farm
            </Link>
          </section>
        ) : (
          <ul className="space-y-4">
            {farms.map((farm) => (
              <li key={farm.id}>
                <FarmCard farm={farm} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
