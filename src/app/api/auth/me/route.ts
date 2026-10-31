import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  // { user: null } when signed out (200 on purpose, so the login page can
  // check quietly without a console error). Role checks live in the
  // guarded routes, which do return 401/403.
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
