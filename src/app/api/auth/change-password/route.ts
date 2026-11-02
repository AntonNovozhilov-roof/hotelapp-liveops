import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEmployeeByLogin, hashPassword, updateEmployee, verifyPassword } from "@/lib/employees";
import { foreignOriginResponse } from "@/lib/security";

/** Change own password (E1): real employee accounts. Demo accounts keep the demo password. */
export async function POST(request: Request) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: "Demo accounts use the demo password and cannot change it. Real accounts (added on Team) can." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const current = typeof r.currentPassword === "string" ? r.currentPassword : "";
  const next = typeof r.newPassword === "string" ? r.newPassword : "";
  if (next.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  const employee = await getEmployeeByLogin(user.username);
  if (!employee || employee.id !== user.employeeId) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!verifyPassword(current, employee.passwordHash)) return NextResponse.json({ error: "Your current password is not right." }, { status: 401 });
  await updateEmployee(employee.id, { passwordHash: hashPassword(next) });
  return NextResponse.json({ ok: true });
}
