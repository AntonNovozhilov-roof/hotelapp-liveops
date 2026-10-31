import Link from "next/link";
import { redirect } from "next/navigation";
import HistoryBoard from "@/components/HistoryBoard";
import SessionBar from "@/components/SessionBar";
import { getCurrentUser } from "@/lib/auth";

/**
 * History page (M9 / ANT-25): every step of every task, newest first,
 * with filters and a per-task timeline (?task=<id>). Owner and
 * Supervisor only — the server checks again on /api/history.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const { task } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <p className="mt-4 text-[13px]">
        <Link
          href={user.role === "owner" ? "/owner" : "/supervisor"}
          className="font-semibold text-brand-700 hover:underline"
        >
          ← Back
        </Link>
      </p>
      <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight">
        History
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-3">
        Who did what, and when — for every task, room and photo. The guest
        chat itself is never saved, only the request.
      </p>
      <div className="mt-5">
        <HistoryBoard focusTaskId={task} />
      </div>
    </main>
  );
}
