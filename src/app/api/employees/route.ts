import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanLogin, createEmployee, generatePassword, listEmployees, toPublicEmployee, validLogin } from "@/lib/employees";
import { DEMO_USERS, ROLE_META, STAFF_ROLES, isRoleKey, type RoleKey } from "@/lib/users";
import { foreignOriginResponse } from "@/lib/security";
import { appendHistory } from "@/lib/history";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can open Team." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard(); if ("error" in g) return g.error;
  const employees = await listEmployees();
  return NextResponse.json({ employees: employees.map(toPublicEmployee), demoUsernames: DEMO_USERS.map((u) => u.username) });
}

export async function POST(request: Request) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const g = await guard(); if ("error" in g) return g.error;
  const user = g.user!;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
  const login = cleanLogin(r.login);
  const role = r.role;
  if (!name) return NextResponse.json({ error: "Please write the person's full name." }, { status: 400 });
  if (!validLogin(login)) return NextResponse.json({ error: "Login must be 3–30 characters: lowercase letters, numbers and dots only (for example anna.k)." }, { status: 400 });
  if (DEMO_USERS.some((u) => u.username === login)) return NextResponse.json({ error: `The login "${login}" is already taken. Try another one.` }, { status: 409 });
  if (!isRoleKey(role)) return NextResponse.json({ error: "Please pick a role." }, { status: 400 });
  // Supervisor may only add staff roles (E1).
  if (user.role === "supervisor" && !STAFF_ROLES.includes(role as RoleKey)) {
    return NextResponse.json({ error: "A supervisor can only add staff (Housekeeping, Maintenance, Front desk, Room service)." }, { status: 403 });
  }
  const password = generatePassword();
  const meta = ROLE_META[role as RoleKey];
  const result = await createEmployee({ name, login, role: role as RoleKey, department: meta.department, password });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Employee added", details: `${user.name} added ${name} (${meta.roleLabel}, login ${login}).` });
  // The plain password is returned ONCE here and never stored or shown again.
  return NextResponse.json({ employee: toPublicEmployee(result.employee), password }, { status: 201 });
}
