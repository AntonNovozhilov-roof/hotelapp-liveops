import Link from "next/link";
import { Button, Card, Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-10">
      <Card className="w-full p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-[-0.01em]">
          Guest requests, routed by AI
        </h1>
        <p className="mt-2 text-[14px] text-ink-3">
          Demo start page. In the hotel, each room has a QR code that opens its
          own guest page — no sign-in for guests. Staff, supervisor and the
          owner sign in.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/r/204">
            <Button size="lg" className="w-full sm:w-auto">
              Open Room 204 guest page
            </Button>
          </Link>
          {user ? (
            <Link href={user.home}>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Open my screen ({user.name})
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Sign in (staff, supervisor, owner)
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </main>
  );
}
