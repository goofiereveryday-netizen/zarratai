"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FarmForm } from "@/components/farm-form";
import { ArrowLeftIcon } from "@/components/icons";
import { getFarmById, type Farm } from "@/lib/farms";
import { updateFarm } from "@/app/actions/farms";
import { useAuth } from "@/lib/supabase/auth-context";

export default function EditFarmClient({ farmId }: { farmId: string }) {
  const { user } = useAuth();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getFarmById(farmId).then((result) => {
      if (result) {
        setFarm(result);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [farmId]);

  const userName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  if (loading) {
    return (
      <AppShell userName={userName}>
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm text-forest-floor/60">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (notFound || !farm) {
    return (
      <AppShell userName={userName}>
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm text-forest-floor/60">Farm not found.</p>
          <Link
            href="/farms"
            className="mt-3 inline-flex text-sm font-medium text-olive-branch underline-offset-3 hover:underline"
          >
            Back to My Crops
          </Link>
        </div>
      </AppShell>
    );
  }

  const saveChanges = updateFarm.bind(null, farm.id);

  return (
    <AppShell userName={userName}>
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
            Edit crop
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
