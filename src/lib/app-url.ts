/**
 * Public app address (M11 / ANT-27). QR codes and printed login cards must
 * point at the online app, not at whatever address the Owner happened to
 * open (localhost on the Mac, a preview URL, ...). Set APP_URL in Vercel
 * (and optionally in .env.local) to the public https address, no path.
 * Server only: pages read it and pass the value to client components.
 * Unset or invalid -> null, and callers fall back to the current origin,
 * which keeps plain local dev exactly as before.
 */
export function publicAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
