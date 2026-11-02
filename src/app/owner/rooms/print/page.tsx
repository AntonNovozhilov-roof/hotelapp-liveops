import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, guestLink } from "@/lib/hotel-data";
import PrintButton from "./PrintButton";

export default async function PrintRoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const data = await getHotelData();
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const base = `${proto}://${host}`;
  const cards = await Promise.all(data.rooms.map(async (room) => ({ room, qr: await QRCode.toDataURL(guestLink(room, base), { width: 360, margin: 1 }) })));
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 print:p-0 print:max-w-none">
      <style>{`@media print { .no-print{display:none!important} body{background:#fff} }`}</style>
      <div className="no-print flex flex-wrap gap-3 items-center justify-between">
        <div><h1 className="font-display text-[22px] font-semibold">Print QR codes</h1><p className="text-[13px] text-ink-3">Use your browser&apos;s Print → Save as PDF, or print this page. One card per room.</p></div>
        <PrintButton />
      </div>
      {cards.length === 0 ? <p className="mt-6 text-[14px]">No rooms yet. Add rooms first on Rooms &amp; QR.</p> : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3">
          {cards.map(({ room, qr }) => (
            <div key={room.id} className="border border-line rounded-xl p-4 text-center break-inside-avoid bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/readybell-logo.png" alt="Readybell" className="mx-auto h-6 w-auto" />
              <p className="mt-1 text-[13px] font-semibold">{data.hotelInfo.hotelName}</p>
              <p className="font-display text-[22px] font-semibold mt-1">Room {room.number}</p>
              <img src={qr} alt={`QR code for room ${room.number}`} className="mx-auto mt-2 w-full max-w-[180px] aspect-square" />
              <p className="text-[13px] mt-1">Scan to message the hotel</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
