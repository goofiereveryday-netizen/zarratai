"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, syntheticEmail } from "@/lib/auth/phone";

export type AuthFormState = {
  error?: string;
};

export async function signup(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");

  // Validate password length
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Normalize phone number
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return {
      error:
        "Enter a valid Pakistan mobile number (e.g. 03001234567).",
    };
  }

  const email = syntheticEmail(normalized);
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone_number: normalized,
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

  // Redirect to login after successful signup
  redirect("/login?created=1");
}

export async function login(
  _state: AuthFormState,
  formData: FormData
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
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid mobile number or password." };
  }

  redirect("/");
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
