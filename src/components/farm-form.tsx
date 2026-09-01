"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Farm } from "@/lib/farms";
import type { FarmFormState } from "@/app/actions/farms";

const initialState: FarmFormState = {};

const inputClass =
  "w-full rounded-lg border border-forest-floor/20 bg-white px-4 py-3 text-base text-deep-moss placeholder-forest-floor/30 transition-colors focus:border-olive-branch focus:outline-none focus:ring-2 focus:ring-olive-branch/20";

const labelClass = "mb-1 block text-sm font-medium text-deep-moss";

type FarmFormProps = {
  /** Server action passed from the page (createFarm, or updateFarm bound to an id). */
  action: (state: FarmFormState, formData: FormData) => Promise<FarmFormState>;
  /** Existing farm values when editing. */
  farm?: Farm;
  submitLabel: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function FarmForm({ action, farm, submitLabel }: FarmFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="farm-name" className={labelClass}>
          Farm name
        </label>
        <input
          id="farm-name"
          name="name"
          type="text"
          autoComplete="off"
          placeholder="e.g. Home farm"
          required
          defaultValue={farm?.name}
          className={inputClass}
        />
        <FieldError message={state.errors?.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="district" className={labelClass}>
            District
          </label>
          <input
            id="district"
            name="district"
            type="text"
            autoComplete="off"
            placeholder="e.g. Sahiwal"
            required
            defaultValue={farm?.district}
            className={inputClass}
          />
          <FieldError message={state.errors?.district} />
        </div>

        <div>
          <label htmlFor="tehsil" className={labelClass}>
            Tehsil
          </label>
          <input
            id="tehsil"
            name="tehsil"
            type="text"
            autoComplete="off"
            placeholder="e.g. Sahiwal"
            required
            defaultValue={farm?.tehsil}
            className={inputClass}
          />
          <FieldError message={state.errors?.tehsil} />
        </div>
      </div>

      <div>
        <label htmlFor="area" className={labelClass}>
          Area (acres)
        </label>
        <input
          id="area"
          name="area"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="any"
          placeholder="e.g. 12.5"
          required
          defaultValue={farm ? String(farm.area) : undefined}
          className={inputClass}
        />
        <FieldError message={state.errors?.area} />
      </div>

      <div>
        <label htmlFor="crop" className={labelClass}>
          Crop
        </label>
        <input
          id="crop"
          name="crop"
          type="text"
          autoComplete="off"
          placeholder="e.g. Wheat"
          required
          defaultValue={farm?.crop}
          className={inputClass}
        />
        <FieldError message={state.errors?.crop} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="variety" className={labelClass}>
            Variety <span className="font-normal">(optional)</span>
          </label>
          <input
            id="variety"
            name="variety"
            type="text"
            autoComplete="off"
            placeholder="e.g. Akbar-19"
            defaultValue={farm?.variety ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="crop-stage" className={labelClass}>
            Crop stage <span className="font-normal">(optional)</span>
          </label>
          <input
            id="crop-stage"
            name="crop_stage"
            type="text"
            autoComplete="off"
            placeholder="e.g. Flowering"
            defaultValue={farm?.crop_stage ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="irrigation" className={labelClass}>
          Irrigation <span className="font-normal">(optional)</span>
        </label>
        <input
          id="irrigation"
          name="irrigation"
          type="text"
          autoComplete="off"
          placeholder="e.g. Canal, tube well, rain-fed"
          defaultValue={farm?.irrigation ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Anything else about this farm"
          defaultValue={farm?.notes ?? ""}
          className={inputClass}
        />
      </div>

      {/* General error */}
      {state.error && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-harvest-copper px-6 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citron-beam"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link
          href="/farms"
          className="flex items-center justify-center rounded-lg border border-forest-floor/25 px-6 py-3 text-base font-medium text-forest-floor transition-colors hover:bg-forest-floor/5"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
