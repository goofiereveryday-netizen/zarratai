/**
 * Client-safe consultation constants. Kept in a module with no server-only
 * imports so client components can use them without pulling server
 * dependencies (Supabase server client, next/headers) into the browser bundle.
 */

/**
 * Persisted content for an image-scan message sent without any caption text.
 * Shared by the client (optimistic message) and the server action (saved
 * message) so both render the same text.
 */
export const IMAGE_SCAN_DEFAULT_CONTENT = "Sent a crop photo for image scan";
