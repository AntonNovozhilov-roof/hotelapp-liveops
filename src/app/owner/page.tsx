import Link from "next/link";
import { redirect } from "next/navigation";
import OwnerReset from "./OwnerReset";
import CleanRoomForm from "@/components/CleanRoomForm";
import DoneRepairs from "@/components/DoneRepairs";
import SessionBar from "@/components/SessionBar";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { listStoredTasks } from "@/lib/store";

/**
 * Owner home — simple for now (D2 / ANT-38). The real morning report is
 * M10 / ANT-26. Only the Owner sees "Reset demo data" (server-enforced).
 */
export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(user.home);

  const tasks = await listStoredTasks();
  const open = tasks.filter((task) => task.status !== "done").length;
  const inReview = tasks.filter((task) => task.status === "review").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const doneRepairs = tasks.filter(
    (task) => task.type === "repair" && task.status === "done",
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.01em] leading-tight">
        {user.screenTitle}
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-3">{user.screenSub}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">Open tasks</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{open}</p>
          <p className="text-[12.5px] text-ink-3">all teams</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">In review</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{inReview}</p>
          <p className="text-[12.5px] text-ink-3">waiting for a supervisor</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">Done</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{done}</p>
          <p className="text-[12.5px] text-ink-3">approved and finished</p>
        </Card>
      </div>

      <nav className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 gap-3" aria-label="Owner pages">
        <Link href="/supervisor"><Card className="p-4 h-full"><p className="text-[15px] font-semibold">Review</p><p className="mt-1 text-[12.5px] text-ink-3">Approve cleaning work</p></Card></Link>
        <Link href="/owner/rooms"><Card className="p-4 h-full"><p className="text-[15px] font-semibold">Rooms &amp; QR</p><p className="mt-1 text-[12.5px] text-ink-3">Room QR codes to print</p></Card></Link>
        <Link href="/owner/hotel-info"><Card className="p-4 h-full"><p className="text-[15px] font-semibold">Hotel info</p><p className="mt-1 text-[12.5px] text-ink-3">Info the AI can tell guests</p></Card></Link>
        <Link href="/history"><Card className="p-4 h-full"><p className="text-[15px] font-semibold">History</p><p className="mt-1 text-[12.5px] text-ink-3">Who did what, and when</p></Card></Link>
        <Link href="/reports"><Card className="p-4 h-full"><p className="text-[15px] font-semibold">Reports</p><p className="mt-1 text-[12.5px] text-ink-3">Daily and weekly AI reports</p></Card></Link>
      </nav>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Review cleaning work</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          In a small hotel the owner is often the supervisor: you can open
          the supervisor page and approve or send back cleaning tasks there.
        </p>
        <p className="mt-3 text-[13.5px]">
          <Link href="/supervisor" className="font-semibold text-brand-700 hover:underline">
            Open the supervisor review page
          </Link>
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">New cleaning task</h2>
        <div className="mt-3">
          <CleanRoomForm />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">
          Finished repairs — proof photos
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          Repairs finish with a proof photo (no AI check, no review). The
          photo stays here so you can see the finished work.
        </p>
        <div className="mt-3">
          <DoneRepairs tasks={doneRepairs} canReopen={false} />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Reports</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          Your daily report is made automatically after 07:00, and the weekly
          report looks for patterns. Every number is checked against the facts.
        </p>
        <p className="mt-3 text-[13.5px]">
          <Link href="/reports" className="font-semibold text-brand-700 hover:underline">
            Open Reports
          </Link>{" "}
          ·{" "}
          <Link href="/r/204" className="font-semibold text-brand-700 hover:underline">
            Open the guest page (room 204)
          </Link>{" "}
          to create a test task.
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Demo data</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          Only you (the Owner) can clear the demo data. The server refuses
          this for every other account.
        </p>
        <div className="mt-3">
          <OwnerReset />
        </div>
      </Card>
    </main>
  );
}
