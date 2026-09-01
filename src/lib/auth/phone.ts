/**
 * Normalizes a Pakistan mobile number to the format 923XXXXXXXXX.
 *
 * Accepted inputs:
 *   03001234567  → 923001234567
 *   3001234567   → 923001234567
 *   +923001234567 → 923001234567
 *
 * Returns null if the input cannot be parsed as a valid Pakistan mobile number.
 */
export function normalizePhone(input: string): string | null {
  // Strip all non-digit characters
  const digits = input.replace(/\D/g, "");

  let normalized: string;

  if (digits.startsWith("92") && digits.length === 12) {
    // Already has country code: 923001234567
    normalized = digits;
  } else if (digits.startsWith("0") && digits.length === 11) {
    // Local format with leading zero: 03001234567
    normalized = "92" + digits.slice(1);
  } else if (digits.length === 10) {
    // Without country code or leading zero: 3001234567
    normalized = "92" + digits;
  } else {
    return null;
  }

  // Validate: must start with 923 (Pakistan mobile prefix)
  if (!normalized.startsWith("923")) {
    return null;
  }

  return normalized;
}

/**
 * Derives the synthetic internal email used for Supabase auth.
 * This email is never displayed to the user.
 */
export function syntheticEmail(normalizedPhone: string): string {
  return `${normalizedPhone}@auth.zarratai.invalid`;
}
