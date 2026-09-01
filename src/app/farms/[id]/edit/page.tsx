import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FarmForm } from "@/components/farm-form";
import { ArrowLeftIcon } from "@/components/icons";
import { getFarmById } from "@/lib/farms";
import { updateFarm } from "@/app/actions/farms";

export default async function EditFarmPage({
  params,
}: PageProps<"/farms/[id]/edit">) {
  const { id } = await params;

  // RLS only returns the farm when it belongs to the signed-in user.
  const farm = await getFarmById(id);
  if (!farm) {
    notFound();
  }

  const saveChanges = updateFarm.bind(null, farm.id);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/farms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-olive-branch underline-offset-2 hover:underline"
        >
          <ArrowLeftIcon />
          Back to My Farms
        </Link>

        <div className="mt-3">
          <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
            Edit farm
          </h1>
          <p className="mt-1 text-sm text-forest-floor/70">
            Update the details of {farm.name}.
          </p>
        </div>

        <div className="mt-6">
          <FarmForm action={saveChanges} farm={farm} submitLabel="Save changes" />
        </div>
      </div>
    </AppShell>
  );
}
