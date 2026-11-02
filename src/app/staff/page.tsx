import { redirect } from "next/navigation";
import StaffBoard from "./StaffBoard";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ensureAutoCheckoutTasks } from "@/lib/bookings";

/**
 * Staff role screens (D2 / ANT-38): the signed-in person decides which
 * screen this is — cleaner (housekeeping), maintenance, front desk or
 * room service — and they only ever see their own department's tasks.
 */
export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.department) redirect(user.home);
  await ensureAutoCheckoutTasks();

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title={user.screenTitle} sub={<>{user.screenSub} Move each task forward by its type: requests finish with Done (no photo), repairs need a proof photo, cleaning needs a photo and an AI check before a supervisor review.</>} />

      <div className="mt-5">
        <StaffBoard user={user} />
      </div>
    </main>
  );
}
