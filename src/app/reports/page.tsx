import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
import ReportsBoard from "./ReportsBoard";
import { getCurrentUser } from "@/lib/auth";
import { listReports } from "@/lib/reports-store";
import { countSampleTasks } from "@/lib/store";

/** Reports (M10/S6): Owner + Supervisor only. Staff are sent to their own screen. */
export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const [reports, sampleCount] = await Promise.all([listReports(), countSampleTasks()]);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title="Reports" sub="What needs your attention, written from the real task facts. Tap any point to see the tasks behind it. Every number is checked against the facts before you see it." />
      <div className="mt-5">
        <ReportsBoard initialReports={reports} isOwner={user.role === "owner"} initialSampleCount={sampleCount} />
      </div>
    </main>
  );
}
