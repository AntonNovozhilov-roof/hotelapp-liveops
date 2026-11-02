import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
import TeamBoard from "@/components/TeamBoard";
import { getCurrentUser } from "@/lib/auth";
import { listEmployees, toPublicEmployee } from "@/lib/employees";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const employees = await listEmployees();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title="Team" sub={user.role === "owner" ? "Add people, reset passwords, deactivate leavers. History always keeps the real person's name — accounts are never deleted." : "You can add and edit staff (Housekeeping, Maintenance, Front desk, Room service). Supervisors and the Owner are managed by the Owner."} />
      <div className="mt-5"><TeamBoard initial={employees.map(toPublicEmployee)} isOwner={user.role === "owner"} currentEmployeeId={user.employeeId ?? null} /></div>
    </main>
  );
}
