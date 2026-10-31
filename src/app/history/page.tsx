import { redirect } from "next/navigation";
import HistoryBoard from "@/components/HistoryBoard";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
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
      <PageHeader title="History" sub="Who did what, and when — for every task, room and photo. The guest chat itself is never saved, only the request." />
      <div className="mt-5">
        <HistoryBoard focusTaskId={task} />
      </div>
    </main>
  );
}
