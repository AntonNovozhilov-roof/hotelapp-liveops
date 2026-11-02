"use client";
import { useState } from "react";
import { Badge, Button, Card, Empty, Field, Input } from "@/components/ui";
import type { PublicEmployee } from "@/lib/employees";
import { ROLE_META, STAFF_ROLES, type RoleKey } from "@/lib/users";

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: "housekeeping", label: "Housekeeping" }, { value: "maintenance", label: "Maintenance" },
  { value: "front_desk", label: "Front desk" }, { value: "room_service", label: "Room service" },
  { value: "supervisor", label: "Supervisor" }, { value: "owner", label: "Owner" },
];

export default function TeamBoard({ initial, isOwner, currentEmployeeId }: { initial: PublicEmployee[]; isOwner: boolean; currentEmployeeId: string | null }) {
  const [people, setPeople] = useState(initial);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<RoleKey>("housekeeping");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [once, setOnce] = useState<{ name: string; login: string; password: string; title: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<RoleKey>("housekeeping");

  const roleOptions = ROLE_OPTIONS.filter((o) => isOwner || STAFF_ROLES.includes(o.value));
  const appLink = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

  async function refresh() {
    const res = await fetch("/api/employees", { cache: "no-store" });
    if (res.ok) { const d = (await res.json()) as { employees: PublicEmployee[] }; setPeople(d.employees); }
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); } catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); setCopied(label);
    }
  }

  function printCard() {
    if (!once) return;
    const w = window.open("", "_blank", "width=520,height=420");
    if (!w) { setError("The print window was blocked. Copy the login card text instead."); return; }
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    w.document.write(`<!doctype html><title>Login card — ${esc(once.name)}</title><body style="font-family:sans-serif;padding:24px"><h1 style="font-size:20px">Readybell — login card</h1><p><strong>Name:</strong> ${esc(once.name)}</p><p><strong>Login:</strong> ${esc(once.login)}</p><p><strong>Password:</strong> ${esc(once.password)}</p><p><strong>App:</strong> ${esc(appLink)}</p><p>Sign in, then change your password from the menu with your name (top right).</p></body>`);
    w.document.close(); w.focus(); w.print();
  }

  async function add() {
    setBusy(true); setError(null); setMsg(null); setCopied(null);
    try {
      const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, login, role }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; employee?: PublicEmployee; password?: string };
      if (!res.ok || !d.employee || !d.password) throw new Error(d.error || "Could not add this person.");
      setOnce({ name: d.employee.name, login: d.employee.login, password: d.password, title: "New account — password shown once" });
      setName(""); setLogin("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add this person."); }
    finally { setBusy(false); }
  }

  async function act(id: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(null); setMsg(null); setCopied(null);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; employee?: PublicEmployee; password?: string };
      if (!res.ok || !d.employee) throw new Error(d.error || "That did not work.");
      if (body.action === "reset_password" && d.password) setOnce({ name: d.employee.name, login: d.employee.login, password: d.password, title: "New password — shown once" });
      else setMsg(body.action === "deactivate" ? `${d.employee.name} is deactivated and signed out. Their history stays.` : body.action === "reactivate" ? `${d.employee.name} can sign in again.` : `${d.employee.name} saved.`);
      if (body.action !== "reset_password") setEditId(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "That did not work."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {msg && <p className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] text-ready-deep" role="status">{msg}</p>}
      {error && <p className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Add an employee</h2>
        <p className="mt-1 text-[13px] text-ink-3">We make a strong password for them and show it to you once — share it with the login card, it cannot be shown again.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anna Kowalski" autoComplete="off" /></Field>
          <Field label="Login" hint="Lowercase letters, numbers, dots — e.g. anna.k"><Input value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} placeholder="anna.k" autoComplete="off" /></Field>
          <Field label="Role">
            <select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={role} onChange={(e) => setRole(e.target.value as RoleKey)} aria-label="Role">
              {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Button className="mt-4" size="lg" loading={busy} disabled={!name.trim() || !login.trim()} onClick={() => void add()}>Add employee</Button>
        {!isOwner && <p className="mt-2 text-[12.5px] text-ink-3">As supervisor you can add staff only — the Owner adds supervisors.</p>}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">People ({people.length})</h2>
        {people.length === 0 ? (
          <Empty title="No employees yet" text="Add the first person above. Demo accounts (when DEMO_MODE is on) still work for trying the app, but real people sign in with the accounts you add here." />
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {people.map((person) => {
              const canManage = isOwner || STAFF_ROLES.includes(person.role);
              const isSelf = currentEmployeeId === person.id;
              return (
                <li key={person.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold">{person.name} {isSelf && <span className="text-ink-3">(you)</span>}</p>
                      <p className="text-[12.5px] text-ink-3">{ROLE_META[person.role].roleLabel} · login <code className="font-semibold">{person.login}</code> · {person.lastSignInAt ? `last sign-in ${new Date(person.lastSignInAt).toLocaleString()}` : "never signed in"}</p>
                    </div>
                    <Badge tone={person.active ? "ready" : "dirty"}>{person.active ? "Active" : "Deactivated"}</Badge>
                  </div>
                  {editId === person.id ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Full name" />
                      <select className="h-11 rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={editRole} onChange={(e) => setEditRole(e.target.value as RoleKey)} aria-label="Role" disabled={!canManage}>
                        {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <Button size="sm" loading={busy} onClick={() => void act(person.id, { name: editName, role: editRole })}>Save</Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : canManage ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setEditId(person.id); setEditName(person.name); setEditRole(person.role); }}>Edit name / role</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(person.id, { action: "reset_password" })}>Reset password</Button>
                      {person.active ? (
                        <Button size="sm" variant="danger" disabled={busy || isSelf} onClick={() => void act(person.id, { action: "deactivate" }, `Deactivate ${person.name}? They will be signed out and cannot sign in. Their history is kept.`)}>Deactivate</Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => void act(person.id, { action: "reactivate" })}>Reactivate</Button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[12.5px] text-ink-3">Only the Owner can change this account.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-3">Accounts are never deleted, so history always shows the real person. Deactivated people are signed out straight away and cannot sign in.</p>
      </Card>

      {once && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={once.title}>
          <Card className="w-full max-w-md p-5">
            <h2 className="font-display text-[19px] font-semibold">{once.title}</h2>
            <p className="mt-2 rounded-lg bg-occ-soft px-3 py-2 text-[13.5px] font-semibold text-occ-deep">Write it down or share the login card now — this password cannot be shown again. If it is lost, use Reset password.</p>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4 text-center">
              <p className="text-[12px] font-semibold text-ink-3">Readybell login card</p>
              <p className="mt-2 text-[15px] font-semibold">{once.name}</p>
              <p className="text-[13px] text-ink-3">Login: <code className="font-semibold text-ink">{once.login}</code></p>
              <p className="mt-1 break-all font-mono text-[17px] font-bold">{once.password}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">{appLink}</p>
            </div>
            {copied && <p className="mt-2 text-[13px] font-semibold text-ready-deep" role="status">{copied} copied.</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => void copyText(once.password, "Password")}>Copy password</Button>
              <Button variant="secondary" onClick={() => void copyText(`Readybell login card\nName: ${once.name}\nLogin: ${once.login}\nPassword: ${once.password}\nApp: ${appLink}`, "Login card")}>Copy login card</Button>
              <Button variant="secondary" onClick={printCard}>Print / share login card</Button>
              <Button onClick={() => setOnce(null)}>I saved it — close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
