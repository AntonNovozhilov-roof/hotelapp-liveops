import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadDemoHotel } from "@/lib/demo-hotel";

/** Load the demo hotel (H1). Owner only — the server checks, not just the page. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can load the demo hotel." }, { status: 403 });
  const result = await loadDemoHotel(user.name);
  return NextResponse.json({ ok: true, ...result });
}
