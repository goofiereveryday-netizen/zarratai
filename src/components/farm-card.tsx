"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { deleteFarm, selectFarm } from "@/app/actions/farms";
import type { Farm } from "@/lib/farms";

export function FarmCard({ farm }: { farm: Farm }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSelect() {
    setError(null);
    startTransition(async () => {
      const result = await selectFarm(farm.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteFarm(farm.id);
      if (result.error) {
        setError(result.error);
        setConfirmingDelete(false);
      }
    });
  }

  const areaLabel = `${farm.area} acre${farm.area === 1 ? "" : "s"}`;

  return (
    <article
      className={`rounded-xl bg-wheat-cream-light p-4 ${
        farm.is_selected
          ? "border-2 border-olive-branch/50"
          : "border border-forest-floor/10"
      }`}
    >
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-deep-moss">
          <span className="truncate">{farm.name}</span>
          {farm.is_selected && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-olive-branch/10 px-2.5 py-0.5 text-xs font-medium text-olive-branch">
              <CheckIcon />
              Selected
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-forest-floor/80">
          {farm.district}, {farm.tehsil}
        </p>
        <p className="mt-0.5 text-sm text-forest-floor">
          {areaLabel} · {farm.crop}
          {farm.variety ? ` (${farm.variety})` : ""}
        </p>
        {farm.crop_stage && (
          <p className="mt-0.5 text-sm text-forest-floor/70">
            Stage: {farm.crop_stage}
          </p>
        )}
        {farm.irrigation && (
          <p className="mt-0.5 text-sm text-forest-floor/70">
            Irrigation: {farm.irrigation}
          </p>
        )}
        {farm.notes && (
          <p className="mt-0.5 text-sm text-forest-floor/70">{farm.notes}</p>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-forest-floor/10 pt-3">
        {farm.is_selected ? (
          <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-olive-branch">
            <CheckIcon />
            Selected
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSelect}
            disabled={pending}
            className="rounded-md bg-olive-branch px-4 py-2 text-sm font-medium text-wheat-cream transition-colors hover:bg-olive-branch/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citron-beam"
          >
            {pending ? "Selecting..." : "Select"}
          </button>
        )}

        <Link
          href={`/farms/${farm.id}/edit`}
          className="rounded-md border border-forest-floor/20 px-4 py-2 text-sm font-medium text-forest-floor transition-colors hover:bg-forest-floor/5"
        >
          Edit
        </Link>

        {confirmingDelete ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-red-800">
              Delete this farm?
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
              className="rounded-md border border-forest-floor/20 px-3 py-2 text-sm font-medium text-forest-floor transition-colors hover:bg-forest-floor/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
            className="rounded-md px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
