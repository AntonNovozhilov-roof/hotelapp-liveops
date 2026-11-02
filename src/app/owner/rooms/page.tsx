import Link from "next/link";
import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
import RoomsBoard from "@/components/RoomsBoard";
import RoomsPricesBoard from "@/components/RoomsPricesBoard";
import BookingsBoard from "@/components/BookingsBoard";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, publicRoom } from "@/lib/hotel-data";
import { ensureAutoCheckoutTasks, listBookings } from "@/lib/bookings";

const TABS = [
  { key: "rooms", label: "Rooms & prices" },
  { key: "bookings", label: "Bookings" },
  { key: "qr", label: "QR codes" },
] as const;

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const { tab: tabRaw } = await searchParams;
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as string) : "rooms";
  await ensureAutoCheckoutTasks();
  const data = await getHotelData();
  const bookings = tab === "qr" ? [] : await listBookings();
  const canEdit = user.role === "owner";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title="Rooms" sub="Room types and prices, manual bookings, and the QR code for each room." />
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Rooms sections" role="tablist">
        {TABS.map((t) => (
          <Link key={t.key} href={`/owner/rooms?tab=${t.key}`} role="tab" aria-selected={tab === t.key} className={`inline-flex min-h-11 items-center rounded-lg px-3.5 text-[13.5px] font-semibold ${tab === t.key ? "bg-brand-700 text-white" : "bg-white text-ink-2 ring-1 ring-line hover:text-brand-700"}`}>{t.label}</Link>
        ))}
      </nav>
      <div className="mt-5">
        {tab === "qr" && <RoomsBoard initialRooms={data.rooms.map(publicRoom) as never} initialSettings={data.settings} hotelName={data.hotelInfo.hotelName} canEdit={canEdit} />}
        {tab === "rooms" && <RoomsPricesBoard initialRooms={data.rooms.map(publicRoom) as never} bookings={bookings} currency={data.settings.currency} canEdit={canEdit} />}
        {tab === "bookings" && <BookingsBoard initialBookings={bookings} rooms={data.rooms.map((r) => ({ id: r.id, number: r.number, floor: r.floor, roomType: r.roomType, pricePerNight: r.pricePerNight }))} currency={data.settings.currency} canEdit={user.role === "owner" || user.role === "supervisor"} />}
      </div>
    </main>
  );
}
