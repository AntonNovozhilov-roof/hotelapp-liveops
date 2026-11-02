import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

/** Roles that may open Guest messages (G3): front desk, supervisor, owner. */
export const HANDOFF_ROLES = ["front_desk", "supervisor", "owner"] as const;

export async function guardHandoff() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (!(HANDOFF_ROLES as readonly string[]).includes(user.role)) {
    return { error: NextResponse.json({ error: "Only the front desk, a supervisor or the Owner can open Guest messages." }, { status: 403 }) };
  }
  return { user };
}
