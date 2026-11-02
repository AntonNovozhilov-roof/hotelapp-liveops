import { NextResponse } from "next/server";
import { isDemoMode, isDemoResetAllowed } from "@/lib/security";

/** Public demo flags for the sign-in page (SEC1). No secrets, just on/off. */
export async function GET() {
  return NextResponse.json({ demoMode: isDemoMode(), demoResetAllowed: isDemoResetAllowed() });
}
