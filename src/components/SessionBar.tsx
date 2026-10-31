"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar, Button, Logo } from "@/components/ui";
import type { PublicUser } from "@/lib/users";

/** Same navigation pattern per role on every signed-in screen (U1). */
const NAV: Record<string, { href: string; label: string }[]> = {
  owner: [
    { href: "/owner", label: "Owner home" }, { href: "/supervisor", label: "Review" },
    { href: "/reports", label: "Reports" }, { href: "/owner/rooms", label: "Rooms & QR" },
    { href: "/owner/hotel-info", label: "Hotel info" }, { href: "/history", label: "History" },
  ],
  supervisor: [
    { href: "/supervisor", label: "Supervisor home" }, { href: "/reports", label: "Reports" },
    { href: "/owner/rooms", label: "Rooms & QR" }, { href: "/history", label: "History" },
  ],
};

export function RoleNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const items = NAV[user.role] ?? [{ href: "/staff", label: "My board" }];
  return (
    <nav aria-label="Your pages" className="mt-4 flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = pathname === item.href;
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

/** Top bar on signed-in screens: who you are + Sign out (v1.2 staff shell style). */
export default function SessionBar({ user }: { user: PublicUser }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
    <div className="flex flex-wrap items-center gap-3">
      <Logo />
      <div className="ml-auto flex items-center gap-3">
        <Avatar name={user.name} role={user.role} size={34} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight">Hi, {user.name}</p>
          <p className="truncate text-[12px] text-ink-3">{user.roleLabel}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<LogOut className="size-4" />}
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
    <RoleNav user={user} />
    </div>
  );
}
