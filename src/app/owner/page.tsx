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
        <h2 className="text-[15px] font-semibold">Morning report (coming in M10)</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          Soon a Generate button here will write your short morning report
          from the real task facts. For now, these counts come straight from
          the saved tasks.
        </p>
        <p className="mt-3 text-[13.5px]">
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
