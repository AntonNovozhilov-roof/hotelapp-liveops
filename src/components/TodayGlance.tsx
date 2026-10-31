import Link from "next/link";
import { Card } from "@/components/ui";
import { DEPARTMENT_LABELS, type StoredTask } from "@/lib/tasks";

/** "Today at a glance" (U1) for Owner + Supervisor homes: open per team, in review, urgent, today's report. */
export default function TodayGlance({ tasks }: { tasks: StoredTask[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const inReview = tasks.filter((t) => t.status === "review").length;
  const urgent = open.filter((t) => t.priority === "high").length;
  const today = new Date().toDateString();
  const doneToday = tasks.filter((t) => t.status === "done" && new Date(t.updatedAt).toDateString() === today).length;
  return (
    <Card className="mt-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Today at a glance</h2>
        <Link href="/reports" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline sm:min-h-0">Today&apos;s report →</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
        {Object.entries(DEPARTMENT_LABELS).map(([dept, label]) => (
          <div key={dept} className="rounded-xl bg-canvas px-3 py-2.5">
            <p className="text-[12px] font-medium text-ink-3">{label}</p>
            <p className="font-display text-[20px] font-semibold tabular-nums">{open.filter((t) => t.department === dept).length} <span className="text-[12px] font-normal text-ink-3">open</span></p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13.5px] text-ink-2">
        <strong>{inReview}</strong> in review · <strong>{urgent}</strong> urgent open · <strong>{doneToday}</strong> done today
        {urgent > 0 ? " — urgent first." : "."}{" "}
        <Link href="/reports" className="font-semibold text-brand-700 hover:underline">Open today&apos;s report</Link> for what needs attention.
      </p>
    </Card>
  );
}
