import { redirect } from "next/navigation";
import SupervisorBoard from "./SupervisorBoard";
import CleanRoomForm from "@/components/CleanRoomForm";
import DoneRepairs from "@/components/DoneRepairs";
import SessionBar from "@/components/SessionBar";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { listStoredTasks } from "@/lib/store";
import { sortReviewTasks } from "@/lib/tasks";

/**
 * Supervisor review page (M7 / ANT-23): cleaning tasks In review with
 * photos and the AI result, Approve / Send back. The Owner can open and
 * use this page too (in a small hotel the owner is often the supervisor)
 * — the server enforces the same rule on the task API.
 */
export default async function SupervisorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "supervisor" && user.role !== "owner") {
    redirect(user.home);
  }

  const tasks = await listStoredTasks();
  const reviewTasks = sortReviewTasks(
    tasks.filter(
      (task) => task.type === "cleaning" && task.status === "review",
    ),
  );
  const open = tasks.filter((task) => task.status !== "done").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const doneRepairs = tasks.filter(
    (task) => task.type === "repair" && task.status === "done",
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.01em] leading-tight">
        Supervisor review
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-3">
        Cleaning work waiting for your check. Approve it, or send it back
        with a short note. AI problems come first, then the oldest task.
        {user.role === "owner"
          ? " You are signed in as the Owner — you can review here too."
          : ""}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">In review</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{reviewTasks.length}</p>
          <p className="text-[12.5px] text-ink-3">cleaning tasks waiting for you</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">Open tasks</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{open}</p>
          <p className="text-[12.5px] text-ink-3">all teams</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-medium text-ink-3">Done</p>
          <p className="mt-1 font-display text-[26px] font-semibold tabular-nums">{done}</p>
          <p className="text-[12.5px] text-ink-3">approved and finished</p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Review queue</h2>
        <p className="mt-1 text-[12.5px] text-ink-4">
          AI &ldquo;not found&rdquo; or &ldquo;not sure&rdquo; first, then oldest first
        </p>
        <div className="mt-3">
          <SupervisorBoard tasks={reviewTasks} />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Rooms &amp; QR codes</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-3">View and print the room QR codes. Only the Owner can change them.</p>
        <p className="mt-3 text-[13.5px]"><a href="/owner/rooms" className="font-semibold text-brand-700 hover:underline">Open Rooms &amp; QR</a></p>
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
          A repair finishes with a proof photo and no AI check. If the work
          is not right, reopen it with a note — Ruslan sees the note and
          fixes it.
        </p>
        <div className="mt-3">
          <DoneRepairs tasks={doneRepairs} canReopen />
        </div>
      </Card>
    </main>
  );
}
