"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar, Button, Logo } from "@/components/ui";
import type { PublicUser } from "@/lib/users";

/** Top bar on signed-in screens: who you are + Sign out (v1.2 staff shell style). */
export default function SessionBar({ user }: { user: PublicUser }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
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
  );
}
