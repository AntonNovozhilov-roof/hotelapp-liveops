import { redirect } from "next/navigation";
import StaffBoard from "./StaffBoard";
import SessionBar from "@/components/SessionBar";
import { getCurrentUser } from "@/lib/auth";

/**
 * Staff role screens (D2 / ANT-38): the signed-in person decides which
 * screen this is — cleaner (housekeeping), maintenance, front desk or
 * room service — and they only ever see their own department's tasks.
 */
export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.department) redirect(user.home);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.01em] leading-tight">
        {user.screenTitle}
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-3">
        {user.screenSub} Move each task forward: Accept, Start, add a photo,
        Send to review. A supervisor approves it to Done.
      </p>

      <div className="mt-5">
        <StaffBoard user={user} />
      </div>
    </main>
  );
}
