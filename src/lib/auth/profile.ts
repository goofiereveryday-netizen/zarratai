import { createClient } from "@/lib/supabase/client";

/**
 * The user's profile derived from Supabase auth metadata.
 * `name` may be null for accounts created before the name field was added.
 */
export type UserProfile = {
  name: string | null;
  phone: string | null;
};

/**
 * Returns the signed-in user's profile (name + phone) from Supabase auth
 * metadata, or null when no user is signed in. Server-side only.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const metadata = data.user.user_metadata ?? {};
  return {
    name: typeof metadata.full_name === "string" ? metadata.full_name : null,
    phone:
      typeof metadata.phone_number === "string"
        ? metadata.phone_number
        : null,
  };
}

/**
 * Updates the signed-in user's full_name in Supabase auth metadata.
 * Returns the updated name on success, or an error message on failure.
 */
export async function updateUserName(
  name: string
): Promise<{ name: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Name cannot be empty." };
  }
  if (trimmed.length > 100) {
    return { error: "Name must be 100 characters or fewer." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: trimmed },
  });

  if (error) {
    console.error("Failed to update user name:", error.message);
    return { error: "Could not update name. Please try again." };
  }

  return { name: trimmed };
}
