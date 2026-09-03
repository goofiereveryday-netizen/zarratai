import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FarmForm } from "@/components/farm-form";
import { ArrowLeftIcon } from "@/components/icons";
import { createFarm } from "@/app/actions/farms";
import { getCurrentUserProfile } from "@/lib/auth/profile";

export default async function NewFarmPage() {
  const profile = await getCurrentUserProfile();

  return (
    <AppShell userName={profile?.name}>
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/farms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-olive-branch underline-offset-2 hover:underline"
        >
          <ArrowLeftIcon />
          Back to My Crops
        </Link>

        <div className="mt-3">
          <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
            Add a crop
          </h1>
          <p className="mt-1 text-sm text-forest-floor/70">
            Tell ZarratAI about your crop so advice fits your crop and
            location.
          </p>
        </div>

        <div className="mt-6">
          <FarmForm action={createFarm} submitLabel="Add crop" />
        </div>
      </div>
    </AppShell>
  );
}
