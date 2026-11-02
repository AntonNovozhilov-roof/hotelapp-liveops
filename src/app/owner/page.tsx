import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert, Eye, Clock, Info, CheckCircle2 } from "lucide-react";
import CleanRoomForm from "@/components/CleanRoomForm";
import SessionBar from "@/components/SessionBar";
import TodayGlance, { STATUS_KIND, statusKindFor, type StatusKind } from "@/components/TodayGlance";
import { Button, Card } from "@/components/ui";
import LoadDemoHotel from "@/components/LoadDemoHotel";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData } from "@/lib/hotel-data";
import { listStoredTasks } from "@/lib/store";
import { listReports } from "@/lib/reports-store";
import { ensureAutoCheckoutTasks, listBookings } from "@/lib/bookings";
import { loadDemoHotel } from "@/lib/demo-hotel";
import { isDemoMode } from "@/lib/security";

const KIND_ICON: Record<StatusKind, typeof Info> = { urgent: TriangleAlert, review: Eye, done: CheckCircle2, info: Info, guest: Clock };

export default async function OwnerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(user.home);

  let hotel = await getHotelData();
  if (isDemoMode() && hotel.rooms.length === 0) {
    await loadDemoHotel(user.name);
    hotel = await getHotelData();
  }
  await ensureAutoCheckoutTasks();
  const [tasks, bookings, reports] = await Promise.all([listStoredTasks(), listBookings(), listReports()]);

  const attention = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const rank = (t: (typeof tasks)[number]) => (t.priority === "high" ? 0 : t.status === "review" ? 1 : 2);
      return rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, 6);
  const attentionCount = tasks.filter((t) => t.status !== "done" && (t.priority === "high" || t.status === "review")).length;
  const todayReport = reports.find((r) => r.kind === "daily") ?? null;
  const reportPreview = todayReport ? todayReport.points.slice(0, 2).map((p) => p.text).join(" ").slice(0, 220) : null;
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateLine = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="app-main mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />

      <section className="mt-4 rounded-xl2 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-500 px-5 py-5 text-white shadow-card sm:px-6">
        <p className="font-display text-[24px] font-semibold leading-tight">{greeting}, Owner</p>
        <p className="mt-1 text-[13.5px] text-brand-50">{dateLine} · {hotel.hotelInfo.hotelName}</p>
        <p className="mt-2 text-[14px] font-semibold">{attentionCount === 0 ? "Everything is in hand." : `${attentionCount} thing${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} your attention`}</p>
      </section>

      {hotel.rooms.length === 0 && (
        <Card className="mt-4 border-brand-200 bg-brand-50 p-5">
          <h2 className="text-[15px] font-semibold">Start here: load the hotel</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">One tap creates rooms (floor 1: 101–110, floor 2: 201–210), hotel info and a few tasks, ready to try.</p>
          <div className="mt-3"><LoadDemoHotel /></div>
        </Card>
      )}

      <TodayGlance tasks={tasks} bookings={bookings} currency={hotel.settings.currency} roomsTotal={hotel.rooms.length} />

      <Card className="mt-5 p-5">
        <h2 className="text-[15px] font-semibold">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-ink-3">Nothing waiting right now. New guest requests and urgent work will appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-2">
            {attention.map((task) => {
              const kind = statusKindFor(task);
              const style = STATUS_KIND[kind];
              const Icon = KIND_ICON[kind];
              const href = task.status === "review" ? "/supervisor" : task.department === "front_desk" ? "/guest-messages" : "/history";
              return (
                <li key={task.id} className={`flex items-center gap-3 border-l-4 py-3 pl-3 ${style.border}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line`}><Icon className="size-4 text-ink-2" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">Room {task.room} · {task.title}</p>
                    <p className="text-[12px] text-ink-3">{new Date(task.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className={`hidden shrink-0 items-center rounded-md px-2 py-1 text-[12px] font-semibold ring-1 ring-inset min-[420px]:inline-flex ${style.pill}`}>{task.status === "review" ? "In review" : task.priority === "high" ? "Urgent" : style.label}</span>
                  <Link href={href} className="shrink-0"><Button size="sm" variant="secondary">Open</Button></Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section className="mt-5 rounded-xl2 bg-brand-800 px-5 py-5 text-white shadow-card">
        <div className="h-1 w-10 rounded-full bg-brass" aria-hidden />
        <h2 className="mt-3 text-[15px] font-semibold">Today&apos;s report</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-50">{reportPreview ?? "Your daily report will appear here once it has been made. Open the report page to make one from today's facts."}</p>
        <Link href="/reports" className="mt-3 inline-block"><Button variant="secondary">Open report</Button></Link>
      </section>

      <Card className="mt-5 p-5">
        <h2 className="text-[15px] font-semibold">New cleaning task</h2>
        <div className="mt-3"><CleanRoomForm /></div>
      </Card>
    </main>
  );
}
