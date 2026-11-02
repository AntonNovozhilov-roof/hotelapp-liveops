import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generatePassword, getEmployeeById, hashPassword, toPublicEmployee, updateEmployee } from "@/lib/employees";
import { ROLE_META, STAFF_ROLES, isRoleKey, type RoleKey } from "@/lib/users";
import { foreignOriginResponse } from "@/lib/security";
import { appendHistory } from "@/lib/history";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can manage the team." }, { status: 403 }) };
  return { user };
}

function canManage(actorRole: string, targetRole: RoleKey, newRole?: RoleKey): string | null {
  if (actorRole === "owner") return null;
  // Supervisor: staff targets and staff roles only.
  if (!STAFF_ROLES.includes(targetRole)) return "A supervisor cannot change supervisors or the owner.";
  if (newRole && !STAFF_ROLES.includes(newRole)) return "A supervisor can only give staff roles.";
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const g = await guard(); if ("error" in g) return g.error;
  const user = g.user!;
  const { id } = await params;
  const target = await getEmployeeById(id);
  if (!target) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const action = typeof r.action === "string" ? r.action : "edit";

  if (action === "reset_password") {
    const denied = canManage(user.role, target.role); if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    const password = generatePassword();
    const updated = await updateEmployee(id, { passwordHash: hashPassword(password) });
    await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Password reset", details: `${user.name} reset the password for ${target.name}.` });
    return NextResponse.json({ employee: toPublicEmployee(updated!), password });
  }
  if (action === "deactivate" || action === "reactivate") {
    const denied = canManage(user.role, target.role); if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    if (action === "deactivate" && user.employeeId === id) return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    const updated = await updateEmployee(id, { active: action === "reactivate" });
    await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: action === "reactivate" ? "Employee reactivated" : "Employee deactivated", details: `${user.name} ${action === "reactivate" ? "reactivated" : "deactivated"} ${target.name}. History is kept.` });
    return NextResponse.json({ employee: toPublicEmployee(updated!) });
  }
  // Edit name / role
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : target.name;
  if (!name) return NextResponse.json({ error: "Please write the person's full name." }, { status: 400 });
  const role: RoleKey = isRoleKey(r.role) ? r.role : target.role;
  const denied = canManage(user.role, target.role, role); if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const updated = await updateEmployee(id, { name, role, department: ROLE_META[role].department });
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Employee updated", details: `${user.name} updated ${name} (${ROLE_META[role].roleLabel}).` });
  return NextResponse.json({ employee: toPublicEmployee(updated!) });
}
