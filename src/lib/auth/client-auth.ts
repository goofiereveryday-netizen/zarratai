import { createClient } from "@/lib/supabase/client";
import { normalizePhone, syntheticEmail } from "@/lib/auth/phone";

export type AuthFormState = {
  error?: string;
};

export type ProfileFormState = {
  error?: string;
  success?: string;
};

export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!name) {
    return { error: "Please enter your name." };
  }
  if (name.length > 100) {
    return { error: "Name must be 100 characters or fewer." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return {
      error:
        "Enter a valid Pakistan mobile number (e.g. 03001234567).",
    };
  }

  const email = syntheticEmail(normalized);
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone_number: normalized,
        full_name: name,
      },
    },
  });

  if (error) {
    if (
      error.message.includes("already registered") ||
      error.message.includes("already been registered")
    ) {
      return { error: "This mobile number is already registered." };
    }
    return { error: error.message };
  }

  window.location.href = "/login?created=1";
  return {};
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: "Please enter your mobile number and password." };
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return {
      error:
        "Enter a valid Pakistan mobile number (e.g. 03001234567).",
    };
  }

  const email = syntheticEmail(normalized);
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid mobile number or password." };
  }

  window.location.href = "/";
  return {};
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export async function updateProfileName(
  _state: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Name cannot be empty." };
  }
  if (name.length > 100) {
    return { error: "Name must be 100 characters or fewer." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: name },
  });

  if (error) {
    console.error("Failed to update name:", error.message);
    return { error: "Could not update name. Please try again." };
  }

  return { success: "Name updated." };
}
