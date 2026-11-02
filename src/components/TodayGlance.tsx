import { BedDouble, CalendarDays, ClipboardList, Eye } from "lucide-react";
import type { StoredTask } from "@/lib/tasks";
import { todayStr, addDaysStr, type Booking } from "@/lib/booking-types";

/** Shared status kinds (U3): urgent red, review amber, done green, info teal, guest waiting blue. */
export type StatusKind = "urgent" | "review" | "done" | "info" | "guest";
export const STATUS_KIND: Record<StatusKind, { label: string; pill: string; dot: string; border: string }> = {
  urgent: { label: "Urgent", pill: "bg-dirty-soft text-dirty-deep ring-dirty/25", dot: "bg-dirty", border: "border-l-dirty" },
  review: { label: "In review", pill: "bg-occ-soft text-occ-deep ring-occ/25", dot: "bg-occ", border: "border-l-occ" },
  done: { label: "Done", pill: "bg-ready-soft text-ready-deep ring-ready/25", dot: "bg-ready", border: "border-l-ready" },
  info: { label: "Info", pill: "bg-brand-50 text-brand-700 ring-brand-100", dot: "bg-brand-500", border: "border-l-brand-500" },
  guest: { label: "Guest waiting", pill: "bg-clean-soft text-clean-deep ring-clean/25", dot: "bg-clean", border: "border-l-clean" },
};
export function statusKindFor(task: StoredTask): StatusKind {
  if (task.status === "done") return "done";
  if (task.status === "review") return "review";
  if (task.priority === "high") return "urgent";
  if (task.department === "front_desk" && task.status === "new") return "guest";
  return "info";
}

function Bars({ values, barClass }: { values: number[]; barClass: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={`w-[5px] rounded-sm ${barClass}`} style={{ height: `${Math.max(3, Math.round((v / max) * 16))}px`, opacity: 0.35 + 0.65 * (v / max) }} />
      ))}
    </span>
  );
}

export default function TodayGlance({ tasks, bookings, roomsTotal }: { tasks: StoredTask[]; bookings?: Booking[]; currency?: string; roomsTotal?: number }) {
  const todayD = todayStr();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(addDaysStr(todayD, -i));
  const activeB = (bookings ?? []).filter((b) => b.status === "active");
  const occupiedOn = (d: string) => activeB.filter((b) => b.checkIn <= d && d < b.checkOut).length;
  const occupiedTonight = occupiedOn(todayD);
  const occupancy = roomsTotal ? Math.round((occupiedTonight / Math.max(1, roomsTotal)) * 100) : 0;
  const arrivalsToday = activeB.filter((b) => b.checkIn === todayD).length;
  const departuresToday = activeB.filter((b) => b.checkOut === todayD).length;
  const openTasks = tasks.filter((t) => t.status !== "done");
  const inReview = tasks.filter((t) => t.status === "review").length;

  const tiles = [
    {
      label: "Occupancy today", value: `${occupancy}%`, sub: `${occupiedTonight} of ${roomsTotal ?? 0} rooms`,
      tint: "bg-brand-50", chip: "bg-brand-500", bar: "bg-brand-500", Icon: BedDouble,
      trend: days.map((d) => occupiedOn(d)),
    },
    {
      label: "Arrivals & departures", value: `${arrivalsToday} / ${departuresToday}`, sub: "arriving / leaving today",
      tint: "bg-clean-soft", chip: "bg-clean", bar: "bg-clean", Icon: CalendarDays,
      trend: days.map((d) => activeB.filter((b) => b.checkIn === d || b.checkOut === d).length),
    },
    {
      label: "Open tasks", value: String(openTasks.length), sub: "across all teams",
      tint: "bg-occ-soft", chip: "bg-occ", bar: "bg-occ", Icon: ClipboardList,
      trend: days.map((d) => tasks.filter((t) => t.createdAt.slice(0, 10) <= d && (t.status !== "done" || t.updatedAt.slice(0, 10) > d)).length),
    },
    {
      label: "In review", value: String(inReview), sub: "waiting for a check",
      tint: "bg-insp-soft", chip: "bg-insp", bar: "bg-insp", Icon: Eye,
      trend: days.map((d) => tasks.filter((t) => t.status === "review" && t.updatedAt.slice(0, 10) === d).length),
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" role="list" aria-label="Today at a glance">
      {tiles.map(({ label, value, sub, tint, chip, bar, Icon, trend }) => (
        <div key={label} role="listitem" className={`rounded-xl2 border border-line shadow-card transition hover:shadow-pop ${tint} px-4 py-3.5`}>
          <div className="flex items-start justify-between gap-2">
            <span className={`grid size-9 place-items-center rounded-full text-white ${chip}`}><Icon className="size-4.5" aria-hidden /></span>
            <Bars values={trend} barClass={bar} />
          </div>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none tabular-nums text-ink">{value}</p>
          <p className="mt-1 text-[12.5px] font-semibold text-ink-2">{label}</p>
          <p className="text-[12px] text-ink-3">{sub}</p>
        </div>
      ))}
    </div>
  );
}
