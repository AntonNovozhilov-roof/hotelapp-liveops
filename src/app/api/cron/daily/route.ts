import { NextResponse } from "next/server";
import { ensureAutoCheckoutTasks } from "@/lib/bookings";
import { pruneExpiredConversations } from "@/lib/conversations";

/**
 * Daily backstop (M11 / ANT-27), called by the Vercel Cron in vercel.json
 * (Hobby allows one run per day). The same jobs also run on page load, so
 * this only covers days when nobody opens the app:
 * - delete closed guest chats past the owner-set retention days;
 * - create check-out-day cleaning tasks that are due (exactly once).
 * The daily report is NOT made here on purpose: it is made on the first
 * Reports page open after 07:00, from the facts at that moment.
 * When CRON_SECRET is set, Vercel sends it as a Bearer token; we require it.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  }
  await pruneExpiredConversations();
  const checkoutTasksCreated = await ensureAutoCheckoutTasks();
  return NextResponse.json({ ok: true, checkoutTasksCreated });
}
