"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FarmFieldErrors = Partial<
  Record<"name" | "district" | "tehsil" | "area" | "crop", string>
>;

export type FarmFormState = {
  /** General error shown above the submit button. */
  error?: string;
  /** Per-field validation errors. */
  errors?: FarmFieldErrors;
};

export type FarmActionResult = {
  error?: string;
};

type FarmFormValues = {
  name: string;
  district: string;
  tehsil: string;
  area: number;
  crop: string;
  variety: string | null;
  crop_stage: string | null;
  irrigation: string | null;
  notes: string | null;
};

/**
 * Returns the signed-in user's Supabase client and id.
 * Redirects to /login when there is no session — server actions are public
 * entry points, so every action re-checks authentication.
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, userId: user.id };
}

function readOptional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

/** Validates the farm form. Area unit is fixed to acres for this UI. */
function validateFarmForm(formData: FormData): {
  values: FarmFormValues | null;
  errors?: FarmFieldErrors;
} {
  const errors: FarmFieldErrors = {};

  const name = String(formData.get("name") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const tehsil = String(formData.get("tehsil") ?? "").trim();
  const crop = String(formData.get("crop") ?? "").trim();
  const areaRaw = String(formData.get("area") ?? "").trim();

  if (!name) errors.name = "Crop name is required.";
  if (!district) errors.district = "District is required.";
  if (!tehsil) errors.tehsil = "Tehsil is required.";
  if (!crop) errors.crop = "Crop is required.";

  let area: number | null = null;
  if (!areaRaw) {
    errors.area = "Area is required.";
  } else {
    area = Number(areaRaw);
    if (!Number.isFinite(area) || area <= 0) {
      errors.area = "Area must be greater than 0 acres.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { values: null, errors };
  }

  return {
    values: {
      name,
      district,
      tehsil,
      area: area as number,
      crop,
      variety: readOptional(formData, "variety"),
      crop_stage: readOptional(formData, "crop_stage"),
      irrigation: readOptional(formData, "irrigation"),
      notes: readOptional(formData, "notes"),
    },
  };
}

export async function createFarm(
  _state: FarmFormState,
  formData: FormData
): Promise<FarmFormState> {
  const { supabase, userId } = await getAuthContext();

  const { values, errors } = validateFarmForm(formData);
  if (!values) {
    return { errors };
  }

  // The user's first farm is selected automatically.
  const { count, error: countError } = await supabase
    .from("farms")
    .select("id", { count: "exact", head: true });
  const isFirstFarm = !countError && (count ?? 0) === 0;

  const now = new Date().toISOString();
  const { error } = await supabase.from("farms").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    name: values.name,
    district: values.district,
    tehsil: values.tehsil,
    area: values.area,
    area_unit: "acre",
    crop: values.crop,
    variety: values.variety,
    crop_stage: values.crop_stage,
    irrigation: values.irrigation,
    notes: values.notes,
    is_selected: isFirstFarm,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    return { error: "Could not add the crop. Please try again." };
  }

  revalidatePath("/farms");
  revalidatePath("/");
  redirect("/farms");
}

export async function updateFarm(
  farmId: string,
  _state: FarmFormState,
  formData: FormData
): Promise<FarmFormState> {
  const { supabase } = await getAuthContext();

  const { values, errors } = validateFarmForm(formData);
  if (!values) {
    return { errors };
  }

  // The .select() check verifies a row was actually updated: RLS blocks
  // updates to other users' farms, which would otherwise be a silent no-op.
  const { data, error } = await supabase
    .from("farms")
    .update({
      name: values.name,
      district: values.district,
      tehsil: values.tehsil,
      area: values.area,
      area_unit: "acre",
      crop: values.crop,
      variety: values.variety,
      crop_stage: values.crop_stage,
      irrigation: values.irrigation,
      notes: values.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", farmId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Could not save changes. Please try again." };
  }
  if (!data) {
    return { error: "Farm not found." };
  }

  revalidatePath("/farms");
  revalidatePath("/");
  redirect("/farms");
}

export async function deleteFarm(farmId: string): Promise<FarmActionResult> {
  const { supabase } = await getAuthContext();

  // Fetch first (RLS only returns the user's own farm) so we know whether
  // the farm being deleted is the selected one.
  const { data: farm, error: fetchError } = await supabase
    .from("farms")
    .select("id, is_selected")
    .eq("id", farmId)
    .maybeSingle();

  if (fetchError) {
    return { error: "Could not delete the crop. Please try again." };
  }
  if (!farm) {
    return { error: "Crop not found." };
  }

  const { error } = await supabase.from("farms").delete().eq("id", farmId);
  if (error) {
    return { error: "Could not delete the crop. Please try again." };
  }

  // If the selected farm was deleted, keep exactly one farm selected by
  // promoting the earliest remaining one.
  if (farm.is_selected) {
    const { data: nextFarm } = await supabase
      .from("farms")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextFarm) {
      await supabase
        .from("farms")
        .update({ is_selected: true, updated_at: new Date().toISOString() })
        .eq("id", nextFarm.id);
    }
  }

  revalidatePath("/farms");
  revalidatePath("/");
  return {};
}

export async function selectFarm(farmId: string): Promise<FarmActionResult> {
  const { supabase, userId } = await getAuthContext();

  // Verify ownership before mutating anything, so a bad id never leaves the
  // user without a selected farm.
  const { data: farm, error: fetchError } = await supabase
    .from("farms")
    .select("id")
    .eq("id", farmId)
    .maybeSingle();

  if (fetchError) {
    return { error: "Could not select the farm. Please try again." };
  }
  if (!farm) {
    return { error: "Farm not found." };
  }

  const now = new Date().toISOString();

  // Unselect the user's other farms, then select this one. Both updates are
  // scoped to the signed-in user; RLS blocks rows owned by anyone else.
  const { error: unselectError } = await supabase
    .from("farms")
    .update({ is_selected: false, updated_at: now })
    .eq("user_id", userId)
    .eq("is_selected", true);

  if (unselectError) {
    return { error: "Could not select the farm. Please try again." };
  }

  const { error: selectError } = await supabase
    .from("farms")
    .update({ is_selected: true, updated_at: now })
    .eq("id", farmId)
    .eq("user_id", userId);

  if (selectError) {
    return { error: "Could not select the farm. Please try again." };
  }

  revalidatePath("/farms");
  revalidatePath("/");
  return {};
}
