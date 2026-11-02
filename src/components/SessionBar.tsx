"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Avatar, Button, Card, Field, Logo, PasswordInput } from "@/components/ui";
import type { PublicUser } from "@/lib/users";

/** Same navigation pattern per role on every signed-in screen (U1). */
const NAV: Record<string, { href: string; label: string }[]> = {
  owner: [
    { href: "/owner", label: "Owner home" }, { href: "/supervisor", label: "Review" },
    { href: "/reports", label: "Reports" }, { href: "/owner/rooms", label: "Rooms" },
    { href: "/owner/hotel-info", label: "Hotel info" }, { href: "/history", label: "History" },
    { href: "/team", label: "Team" },
  ],
  supervisor: [
    { href: "/supervisor", label: "Supervisor home" }, { href: "/reports", label: "Reports" },
    { href: "/owner/rooms", label: "Rooms" }, { href: "/history", label: "History" },
    { href: "/team", label: "Team" },
  ],
};

export function RoleNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const items = NAV[user.role] ?? [{ href: "/staff", label: "My board" }];
  return (
    <nav aria-label="Your pages" className="mt-4 flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = pathname === item.href || (item.href === "/owner/rooms" && pathname.startsWith("/owner/rooms"));
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-[13.5px] font-semibold transition-colors ${active ? "bg-brand-700 text-white" : "bg-white text-ink-2 ring-1 ring-line hover:border-brand-500 hover:text-brand-700"}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Top bar: Readybell logo, profile menu (change own password + sign out) (E1). */
export default function SessionBar({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  async function changePassword() {
    setPwError(null); setPwMsg(null);
    if (next !== confirm) { setPwError("The new passwords do not match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not change the password.");
      setPwMsg("Password changed. Use the new one next time you sign in.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) { setPwError(e instanceof Error ? e.message : "Could not change the password."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Logo responsiveMark />
        <div className="relative ml-auto">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-white">
            <Avatar name={user.name} role={user.role} size={34} />
            <span className="min-w-0 text-left">
              <span className="block text-[14px] font-semibold leading-tight">Hi, {user.name}</span>
              <span className="block truncate text-[12px] text-ink-3">{user.roleLabel} · @{user.username}</span>
            </span>
            <ChevronDown className="size-4 text-ink-3" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop">
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[13.5px] font-semibold hover:bg-canvas" onClick={() => { setMenuOpen(false); setPwOpen(true); setPwError(null); setPwMsg(null); }}>
                <KeyRound className="size-4" /> Change my password
              </button>
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[13.5px] font-semibold hover:bg-canvas" onClick={() => void signOut()}>
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <RoleNav user={user} />

      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Change my password">
          <Card className="w-full max-w-md p-5">
            <h2 className="font-display text-[19px] font-semibold">Change my password</h2>
            <p className="mt-1 text-[13px] text-ink-3">Signed in as {user.name} (@{user.username}).</p>
            {pwMsg && <p className="mt-3 rounded-lg bg-ready-soft px-3 py-2 text-[13.5px] text-ready-deep" role="status">{pwMsg}</p>}
            {pwError && <p className="mt-3 rounded-lg bg-dirty-soft px-3 py-2 text-[13.5px] text-dirty-deep" role="alert">{pwError}</p>}
            <div className="mt-4 space-y-3">
              <Field label="Current password"><PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
              <Field label="New password" hint="At least 8 characters."><PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
              <Field label="New password again"><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" loading={busy} disabled={!current || next.length < 8 || !confirm} onClick={() => void changePassword()}>Save new password</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setPwOpen(false)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
