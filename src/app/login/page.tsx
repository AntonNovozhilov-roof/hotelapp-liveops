"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Avatar, Button, Field, Input, Logo, PasswordInput } from "@/components/ui";
import { DEMO_PASSWORD, DEMO_USERS, type PublicUser } from "@/lib/users";

/** Demo sign-in in the v1.2 auth look (D2 / ANT-38). Real sign-up comes with M2. */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  // Already signed in? Go straight to your own screen.
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { user: PublicUser | null };
        if (data.user) router.replace(data.user.home);
      } catch {
        // Stay on the sign-in page.
      }
    })();
  }, [router]);

  async function signIn(name: string, pass: string) {
    setError(null);
    setBusyName(name);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pass }),
      });
      const data = (await response.json()) as {
        user?: PublicUser;
        error?: string;
      };
      if (!response.ok || !data.user) {
        throw new Error(data.error || "Could not sign in. Please try again.");
      }
      router.push(data.user.home);
      router.refresh();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Could not sign in. Please try again.",
      );
      setBusyName(null);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(420px,0.9fr)] bg-white">
      <div className="flex flex-col px-6 sm:px-12 py-8">
        <div className="self-start">
          <Logo />
        </div>
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.02em]">
              Sign in
            </h1>
            <p className="text-ink-3 mt-1.5 text-[15px]">
              Welcome back. This is a demo sign-in — real accounts come later.
            </p>

            <form
              className="mt-7 space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void signIn(username, password);
              }}
            >
              <Field label="Demo username">
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="for example: aigerim"
                  aria-invalid={!!error}
                />
              </Field>
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!error}
                />
              </Field>
              {error && (
                <p
                  role="alert"
                  className="text-[13.5px] text-dirty-deep bg-dirty-soft rounded-lg px-3 py-2.5"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={busyName !== null}
              >
                Sign in
              </Button>
            </form>

            <div className="mt-10 rounded-2xl border border-line bg-canvas/70 p-4">
              <p className="text-[13px] font-semibold flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand-600" />
                Exploring? Sign in as a demo user
              </p>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                Every demo account uses the password{" "}
                <code className="font-semibold text-ink-2">{DEMO_PASSWORD}</code>.
                Tap a person to sign in as them:
              </p>
              <div className="mt-3 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.username}
                    type="button"
                    disabled={busyName !== null}
                    onClick={() => {
                      setUsername(user.username);
                      setPassword(DEMO_PASSWORD);
                      void signIn(user.username, DEMO_PASSWORD);
                    }}
                    className="flex items-center gap-2 p-1.5 pr-2 rounded-lg hover:bg-white text-left border border-transparent hover:border-line transition disabled:opacity-50"
                  >
                    <Avatar name={user.name} role={user.role} size={26} />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold truncate">
                        {user.roleLabel}
                      </span>
                      <span className="block text-[11.5px] text-ink-3 truncate">
                        {user.username} · {user.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-ink-3 mt-3 pt-3 border-t border-line">
                Guests do not sign in.{" "}
                <Link href="/r/204" className="font-semibold text-brand-700 hover:underline">
                  Open the guest page for room 204 (no login)
                </Link>
              </p>
            </div>
          </div>
        </div>
        <p className="text-[12.5px] text-ink-4">
          © {new Date().getFullYear()} HotelApp
        </p>
      </div>

      <div className="hidden lg:flex relative overflow-hidden bg-brand-950 text-white p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_80%_0%,rgba(46,154,168,.35),transparent_70%)]" />
        <div className="relative">
          <p className="font-display text-[34px] leading-[1.08] font-semibold tracking-[-0.02em] max-w-md">
            “We stopped running the hotel from a WhatsApp group.”
          </p>
          <p className="text-brand-100/70 mt-4 text-[15px]">
            Head of housekeeping, 40-room hotel (pilot)
          </p>
        </div>
        <div className="relative grid grid-cols-2 gap-3 max-w-md">
          {[
            ["−38 min", "morning planning per day"],
            ["2×", "faster room turnover"],
            ["0", "lost repair requests"],
            ["9.1", "cleanliness score"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-white/[.06] ring-1 ring-white/10 p-4">
              <p className="font-display text-[26px] font-semibold text-occ">{value}</p>
              <p className="text-[13px] text-brand-100/75">{label}</p>
            </div>
          ))}
          <p className="col-span-2 text-[11.5px] text-brand-100/50">
            Illustrative figures for the prototype.
          </p>
        </div>
      </div>
    </div>
  );
}
