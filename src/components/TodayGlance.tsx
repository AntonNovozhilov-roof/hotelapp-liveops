import Link from "next/link";
import { Card } from "@/components/ui";
import { DEPARTMENT_LABELS, type StoredTask } from "@/lib/tasks";
import { todayStr, type Booking } from "@/lib/booking-types";
import { formatMoney } from "@/lib/money";

/** "Today at a glance" (U1) for Owner + Supervisor homes: open per team, in review, urgent, today's report. */
export default function TodayGlance({ tasks, bookings, currency, roomsTotal }: { tasks: StoredTask[]; bookings?: Booking[]; currency?: string; roomsTotal?: number }) {
  const open = tasks.filter((t) => t.status !== "done");
  const inReview = tasks.filter((t) => t.status === "review").length;
  const urgent = open.filter((t) => t.priority === "high").length;
  const today = new Date().toDateString();
  const doneToday = tasks.filter((t) => t.status === "done" && new Date(t.updatedAt).toDateString() === today).length;
  const todayD = todayStr();
  const activeB = (bookings ?? []).filter((b) => b.status === "active");
  const occupiedTonight = activeB.filter((b) => b.checkIn <= todayD && todayD < b.checkOut).length;
  // Rooms count comes from bookings' rooms when bookings exist; occupancy needs room total - passed via bookings rooms is unknown, so % uses distinct booked rooms denominator fallback below.
  const arrivalsToday = activeB.filter((b) => b.checkIn === todayD).length;
  const departuresToday = activeB.filter((b) => b.checkOut === todayD).length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  let revenueWeek = 0;
  for (const b of activeB) { let d = b.checkIn < weekStartStr ? weekStartStr : b.checkIn; const end = b.checkOut < todayD ? b.checkOut : todayD; while (d <= end && d < b.checkOut) { if (d >= weekStartStr && d <= todayD) revenueWeek += b.pricePerNight; const nd = new Date(`${d}T12:00:00`); nd.setDate(nd.getDate() + 1); d = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`; } }
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
      {bookings !== undefined && (
        <p className="mt-3 text-[13.5px] text-ink-2">
          <strong>{roomsTotal ? Math.round((occupiedTonight / Math.max(1, roomsTotal)) * 100) : 0}%</strong> occupied today ({occupiedTonight} room{occupiedTonight === 1 ? "" : "s"}) · <strong>{arrivalsToday}</strong> arrival{arrivalsToday === 1 ? "" : "s"} · <strong>{departuresToday}</strong> departure{departuresToday === 1 ? "" : "s"} · <strong>{formatMoney(revenueWeek, currency ?? "USD")}</strong> room revenue this week
        </p>
      )}
      <p className="mt-3 text-[13.5px] text-ink-2">
        <strong>{inReview}</strong> in review · <strong>{urgent}</strong> urgent open · <strong>{doneToday}</strong> done today
        {urgent > 0 ? " — urgent first." : "."}{" "}
        <Link href="/reports" className="font-semibold text-brand-700 hover:underline">Open today&apos;s report</Link> for what needs attention.
      </p>
    </Card>
  );
}
