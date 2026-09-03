"use client";

import { useActionState, useState } from "react";
import { updateProfileName, type ProfileFormState } from "@/app/actions/auth";

const initialState: ProfileFormState = {};

export function SettingsProfileEditor({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateProfileName,
    initialState
  );

  // Close the edit form on success
  if (state.success && editing) {
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-forest-floor/60">
          Name
        </label>
        {editing ? (
          <form action={formAction} className="mt-1 flex gap-2">
            <input
              name="name"
              type="text"
              defaultValue={initialName}
              required
              maxLength={100}
              className="flex-1 rounded-lg border border-forest-floor/20 px-3 py-2 text-sm text-forest-floor placeholder-forest-floor/30 focus:border-olive-branch focus:outline-none focus:ring-2 focus:ring-olive-branch/20"
              placeholder="Your name"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-olive-branch px-4 py-2 text-sm font-medium text-wheat-cream transition-colors hover:bg-olive-branch/90 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-forest-floor/20 px-4 py-2 text-sm font-medium text-forest-floor transition-colors hover:bg-forest-floor/5"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-sm font-medium text-forest-floor">
              {initialName || "Farmer"}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-olive-branch underline-offset-2 hover:underline"
            >
              Edit
            </button>
          </div>
        )}
        {state.error && editing && (
          <p className="mt-1 text-xs text-red-600">{state.error}</p>
        )}
        {state.success && !editing && (
          <p className="mt-1 text-xs text-green-600">{state.success}</p>
        )}
      </div>

      {/* Phone (read-only) */}
      <div>
        <label className="block text-xs font-medium text-forest-floor/60">
          Mobile number
        </label>
        <p className="mt-1 text-sm text-forest-floor">
          {initialPhone || "Not set"}
        </p>
        <p className="mt-0.5 text-xs text-forest-floor/50">
          Mobile number cannot be changed.
        </p>
      </div>
    </div>
  );
}
