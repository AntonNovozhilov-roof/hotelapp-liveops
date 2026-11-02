"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, BedDouble, Building2, ChevronDown, ClipboardCheck, ClipboardList,
  History, Home, KeyRound, LogOut, MessagesSquare, MoreHorizontal, Users, X,
} from "lucide-react";
import { Avatar, Button, Card, Field, Logo, PasswordInput } from "@/components/ui";
import type { PublicUser } from "@/lib/users";

/**
 * App shell in the v1.2 style (U2 / ANT-63, design ported from our earlier
 * v1.2 prototype): sidebar on desktop, compact top bar + bottom tab bar on
 * phones. Same links, roles and profile actions as before — look only.
 */
type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: "guest" | "review" | "new" };

const NAV: Record<string, NavItem[]> = {
  owner: [
    { href: "/owner", label: "Owner home", icon: Home },
    { href: "/supervisor", label: "Review", icon: ClipboardCheck, badge: "review" },
    { href: "/guest-messages", label: "Guest messages", icon: MessagesSquare, badge: "guest" },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/owner/rooms", label: "Rooms", icon: BedDouble },
    { href: "/owner/hotel-info", label: "Hotel info", icon: Building2 },
    { href: "/history", label: "History", icon: History },
    { href: "/team", label: "Team", icon: Users },
  ],
  supervisor: [
    { href: "/supervisor", label: "Supervisor home", icon: Home, badge: "review" },
    { href: "/guest-messages", label: "Guest messages", icon: MessagesSquare, badge: "guest" },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/owner/rooms", label: "Rooms", icon: BedDouble },
    { href: "/history", label: "History", icon: History },
    { href: "/team", label: "Team", icon: Users },
  ],
  front_desk: [
    { href: "/staff", label: "My board", icon: ClipboardList, badge: "new" },
    { href: "/guest-messages", label: "Guest messages", icon: MessagesSquare, badge: "guest" },
  ],
};
const STAFF_NAV: NavItem[] = [{ href: "/staff", label: "My board", icon: ClipboardList, badge: "new" }];

function useNavCounts(user: PublicUser, items: NavItem[]) {
  const canHandoff = items.some((i) => i.href === "/guest-messages");
  const wantTasks = items.some((i) => i.badge === "review" || i.badge === "new");
  const [counts, setCounts] = useState({ guest: 0, review: 0, new: 0 });
  useEffect(() => {
    let live = true;
    const load = async () => {
      const next = { guest: 0, review: 0, new: 0 };
      try {
        if (canHandoff) {
          const res = await fetch("/api/conversations/badge", { cache: "no-store" });
          if (res.ok) { const d = (await res.json()) as { waiting?: number }; next.guest = typeof d.waiting === "number" ? d.waiting : 0; }
        }
        if (wantTasks) {
          const res = await fetch("/api/tasks", { cache: "no-store" });
          if (res.ok) {
            const d = (await res.json()) as { tasks?: { type?: string; status?: string }[] };
            const tasks = d.tasks ?? [];
            next.review = tasks.filter((t) => t.type === "cleaning" && t.status === "review").length;
            next.new = tasks.filter((t) => t.status === "new").length;
          }
        }
      } catch { /* keep last */ }
      if (live) setCounts(next);
    };
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => { live = false; clearInterval(t); };
  }, [canHandoff, wantTasks]);
  return counts;
}

function CountBadge({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span aria-label={`${count} ${label}`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-dirty px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
      {count}
    </span>
  );
}

function ProfileMenu({ user, onChangePassword, signOut, compact }: { user: PublicUser; onChangePassword: () => void; signOut: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`Account menu for ${user.name}`} aria-haspopup="menu" aria-expanded={open} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-brand-50">
        <Avatar name={user.name} role={user.role} size={34} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-tight">{user.name}</span>
            <span className="block truncate text-[12px] text-ink-3">{user.roleLabel} · @{user.username}</span>
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-pop max-lg:bottom-auto max-lg:left-auto max-lg:right-0 max-lg:top-full max-lg:mt-2 max-lg:mb-0">
          <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[13.5px] font-semibold hover:bg-canvas" onClick={() => { setOpen(false); onChangePassword(); }}>
            <KeyRound className="size-4" /> Change my password
          </button>
          <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[13.5px] font-semibold hover:bg-canvas" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function RoleNav({ user }: { user: PublicUser }) {
  // Kept for compatibility; the shell renders navigation itself.
  return <SessionNav user={user} />;
}

function SessionNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const items = NAV[user.role] ?? STAFF_NAV;
  const counts = useNavCounts(user, items);
  const countFor = (item: NavItem) => item.badge === "guest" ? counts.guest : item.badge === "review" ? counts.review : item.badge === "new" ? counts.new : 0;
  const isActive = (item: NavItem) => pathname === item.href || (item.href === "/owner/rooms" && pathname.startsWith("/owner/rooms"));
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-white px-3 py-5 lg:flex" aria-label="App">
        <Link href={user.home} className="flex min-h-11 items-center px-2" aria-label="Readybell home">
          <Logo />
        </Link>
        <nav aria-label="Your pages" className="mt-6 flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon; const active = isActive(item);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors ${active ? "bg-brand-700 text-white shadow-card" : "text-ink-2 hover:bg-brand-50 hover:text-brand-800"}`}>
                <Icon className="size-5 shrink-0" /> <span className="truncate">{item.label}</span>
                <CountBadge count={countFor(item)} label={item.badge === "guest" ? "guests waiting" : item.badge === "review" ? "in review" : "new tasks"} />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line-2 pt-3">
          <ProfileSlot user={user} />
        </div>
      </aside>

      {/* Phone top bar */}
      <div className="sticky top-0 z-40 -mx-4 -mt-6 flex items-center gap-2 border-b border-line/70 bg-canvas/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <Link href={user.home} aria-label="Readybell home" className="flex min-h-11 items-center"><Logo responsiveMark /></Link>
        <div className="ml-auto w-auto"><ProfileSlot user={user} compact /></div>
      </div>

      {/* Phone bottom tab bar */}
      <nav aria-label="Your pages" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${rest.length ? 5 : Math.max(primary.length, 1)}, minmax(0,1fr))` }}>
          {primary.map((item) => {
            const Icon = item.icon; const active = isActive(item); const count = countFor(item);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${active ? "text-brand-700" : "text-ink-3"}`}>
                <span className="relative"><Icon className="size-5" />{count > 0 && <span className="absolute -right-2.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-dirty px-1 text-[10px] font-bold leading-4 text-white">{count}</span>}</span>
                <span className="max-w-full truncate">{item.label.replace("Guest messages", "Messages").replace("Owner home", "Home").replace("Supervisor home", "Home").replace("My board", "My board")}</span>
              </Link>
            );
          })}
          {rest.length > 0 && (
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold text-ink-3">
              <MoreHorizontal className="size-5" /> More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-brand-950/50 lg:hidden" role="dialog" aria-modal="true" aria-label="More pages" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-[17px] font-semibold">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-canvas"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {rest.map((item) => {
                const Icon = item.icon; const active = isActive(item);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold ring-1 ${active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-ink-2 ring-line"}`}>
                    <Icon className="size-5 shrink-0" /> <span className="truncate">{item.label}</span><CountBadge count={countFor(item)} label="waiting" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Profile actions are shared between the sidebar (desktop) and top bar (phone).
const ProfileCtx = createContext<{ openPw: () => void; signOut: () => void } | null>(null);
function ProfileSlot({ user, compact }: { user: PublicUser; compact?: boolean }) {
  const handlers = useContext(ProfileCtx);
  if (!handlers) return null;
  return <ProfileMenu user={user} compact={compact} onChangePassword={handlers.openPw} signOut={handlers.signOut} />;
}

/** App shell: navigation + profile menu (change own password + sign out) (E1). */
export default function SessionBar({ user }: { user: PublicUser }) {
  const router = useRouter();
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
    <ProfileCtx.Provider value={{ openPw: () => { setPwOpen(true); setPwError(null); setPwMsg(null); }, signOut }}>
    <div>
      <SessionNav user={user} />
      {pwOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-brand-950/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Change my password">
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
    </ProfileCtx.Provider>
  );
}
