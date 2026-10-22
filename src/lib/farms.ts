import {
  getLocalFarm,
  getLocalFarms,
  getLocalSelectedFarm,
} from "@/lib/offline/database";
import { getOfflineUserId, isNetworkAvailable } from "@/lib/offline/identity";
import { syncUserData } from "@/lib/offline/sync";

export type Farm = {
  id: string;
  user_id: string;
  name: string;
  district: string;
  tehsil: string;
  area: number;
  area_unit: string | null;
  crop: string;
  variety: string | null;
  crop_stage: string | null;
  irrigation: string | null;
  notes: string | null;
  is_selected: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function refreshInBackground(userId: string): void {
  if (isNetworkAvailable()) {
    void syncUserData(userId).catch((error) => {
      console.warn("Background farm sync failed:", error);
    });
  }
}

export async function getFarms(): Promise<Farm[]> {
  const userId = await getOfflineUserId();
  if (!userId) return [];

  let farms = await getLocalFarms(userId);
  if (farms.length > 0) {
    refreshInBackground(userId);
    return farms;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    farms = await getLocalFarms(userId);
  }
  return farms;
}

export async function getFarmById(id: string): Promise<Farm | null> {
  const userId = await getOfflineUserId();
  if (!userId) return null;

  let farm = await getLocalFarm(userId, id);
  if (farm) {
    refreshInBackground(userId);
    return farm;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    farm = await getLocalFarm(userId, id);
  }
  return farm;
}

export async function getSelectedFarm(): Promise<Farm | null> {
  const userId = await getOfflineUserId();
  if (!userId) return null;

  let farm = await getLocalSelectedFarm(userId);
  if (farm) {
    refreshInBackground(userId);
    return farm;
  }
  if (isNetworkAvailable()) {
    await syncUserData(userId);
    farm = await getLocalSelectedFarm(userId);
  }
  return farm;
}
