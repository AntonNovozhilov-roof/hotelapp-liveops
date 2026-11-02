import Link from "next/link";
import { redirect } from "next/navigation";
import OwnerReset from "./OwnerReset";
import CleanRoomForm from "@/components/CleanRoomForm";
import DoneRepairs from "@/components/DoneRepairs";
import SessionBar from "@/components/SessionBar";
import TodayGlance from "@/components/TodayGlance";
import { Card, PageHeader } from "@/components/ui";
import LoadDemoHotel from "@/components/LoadDemoHotel";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData } from "@/lib/hotel-data";
import { listStoredTasks } from "@/lib/store";
import { loadDemoHotel } from "@/lib/demo-hotel";
import { isDemoMode, isDemoResetAllowed } from "@/lib/security";

/**
 * Owner home — simple for now (D2 / ANT-38). The real morning report is
 * M10 / ANT-26. Only the Owner sees "Reset demo data" (server-enforced).
 */
export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(user.home);

  // DEMO_MODE sandbox: a fresh hotel loads the demo hotel by itself (SEC1).
  let hotel = await getHotelData();
  if (isDemoMode() && hotel.rooms.length === 0) {
    await loadDemoHotel(user.name);
    hotel = await getHotelData();
  }
  const resetAllowed = isDemoResetAllowed();
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
      <PageHeader title={user.screenTitle} sub={user.screenSub} />
      {hotel.rooms.length === 0 && (
        <Card className="mt-4 border-brand-200 bg-brand-50 p-5">
          <h2 className="text-[15px] font-semibold">Start here: load the demo hotel</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            One tap creates demo rooms (floor 1: 101–110, floor 2: 201–210), a sample hotel info sheet and a few sample tasks — all clearly labelled demo data with fake details. Try everything, then remove it all with <strong>Reset demo data</strong> below.
          </p>
          <div className="mt-3"><LoadDemoHotel /></div>
        </Card>
      )}
      <TodayGlance tasks={tasks} />
      <p className="mt-3 text-[13px] text-ink-3">{open} open tasks in total · {inReview} in review · {done} done altogether. The glance above is today only.</p>

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

      {resetAllowed ? (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-semibold">Demo data</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            Only you (the Owner) can clear the demo data. Reset deletes all tasks and photos, rooms and QR codes, the hotel info sheet, history and reports — back to a fresh start. The server refuses this for every other account.
          </p>
          <div className="mt-3">
            <OwnerReset />
          </div>
        </Card>
      ) : (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-semibold">Demo data</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            Reset demo data is turned off on this copy (server setting <code>ALLOW_DEMO_RESET</code>). Turn it on only for a throwaway demo sandbox.
          </p>
        </Card>
      )}
    </main>
  );
}
