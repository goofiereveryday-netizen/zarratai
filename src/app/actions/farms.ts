import {
  deleteLocalRecord,
  getLocalFarm,
  getLocalFarms,
  saveLocalRecord,
  selectLocalFarm,
} from "@/lib/offline/database";
import { getOfflineUserId, isNetworkAvailable } from "@/lib/offline/identity";
import { syncUserData } from "@/lib/offline/sync";
import type { Farm } from "@/lib/farms";

export type FarmFieldErrors = Partial<
  Record<"name" | "district" | "tehsil" | "area" | "crop", string>
>;

export type FarmFormState = {
  error?: string;
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

function readOptional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

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

  if (Object.keys(errors).length > 0) return { values: null, errors };
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

async function getUserIdOrRedirect(): Promise<string | null> {
  const userId = await getOfflineUserId();
  if (!userId) window.location.href = "/login";
  return userId;
}

function requestSync(userId: string): void {
  if (isNetworkAvailable()) {
    void syncUserData(userId).catch((error) => {
      console.warn("Farm changes remain queued for sync:", error);
    });
  }
}

export async function createFarm(
  _state: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const userId = await getUserIdOrRedirect();
  if (!userId) return {};

  const { values, errors } = validateFarmForm(formData);
  if (!values) return { errors };

  if (isNetworkAvailable()) {
    try {
      await syncUserData(userId);
    } catch {
      // The local-first create remains available even if the refresh fails.
    }
  }
  const existingFarms = await getLocalFarms(userId);
  const now = new Date().toISOString();
  const farm: Farm = {
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
    is_selected: existingFarms.length === 0,
    created_at: now,
    updated_at: now,
  };

  await saveLocalRecord("farms", farm);
  requestSync(userId);
  window.location.href = "/farms";
  return {};
}

export async function updateFarm(
  farmId: string,
  _state: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const userId = await getUserIdOrRedirect();
  if (!userId) return {};
  const { values, errors } = validateFarmForm(formData);
  if (!values) return { errors };

  let existing = await getLocalFarm(userId, farmId);
  if (!existing && isNetworkAvailable()) {
    await syncUserData(userId);
    existing = await getLocalFarm(userId, farmId);
  }
  if (!existing) return { error: "Farm not found." };

  const farm: Farm = {
    ...existing,
    ...values,
    area_unit: "acre",
    updated_at: new Date().toISOString(),
  };
  await saveLocalRecord("farms", farm);
  requestSync(userId);
  window.location.href = "/farms";
  return {};
}

export async function deleteFarm(farmId: string): Promise<FarmActionResult> {
  const userId = await getOfflineUserId();
  if (!userId) return { error: "Not authenticated." };

  let farm = await getLocalFarm(userId, farmId);
  if (!farm && isNetworkAvailable()) {
    await syncUserData(userId);
    farm = await getLocalFarm(userId, farmId);
  }
  if (!farm) return { error: "Crop not found." };

  await deleteLocalRecord("farms", userId, farmId);
  if (farm.is_selected) {
    const nextFarm = (await getLocalFarms(userId))[0];
    if (nextFarm) await selectLocalFarm(userId, nextFarm.id);
  }
  requestSync(userId);
  return {};
}

export async function selectFarm(farmId: string): Promise<FarmActionResult> {
  const userId = await getOfflineUserId();
  if (!userId) return { error: "Not authenticated." };

  let farm = await getLocalFarm(userId, farmId);
  if (!farm && isNetworkAvailable()) {
    await syncUserData(userId);
    farm = await getLocalFarm(userId, farmId);
  }
  if (!farm) return { error: "Farm not found." };

  await selectLocalFarm(userId, farmId);
  requestSync(userId);
  return {};
}
