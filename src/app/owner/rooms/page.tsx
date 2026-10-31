import { redirect } from "next/navigation";
import Link from "next/link";
import SessionBar from "@/components/SessionBar";
import RoomsBoard from "@/components/RoomsBoard";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, publicRoom } from "@/lib/hotel-data";

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "supervisor") redirect(user.home);
  const data = await getHotelData();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <p className="mt-4 text-[13px]"><Link href={user.role === "owner" ? "/owner" : "/supervisor"} className="font-semibold text-brand-700 hover:underline">← Back</Link></p>
      <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight">Rooms &amp; QR codes</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">One QR code per room. Guests scan it to message the hotel from that room.</p>
      <div className="mt-5"><RoomsBoard initialRooms={data.rooms.map(publicRoom) as never} initialSettings={data.settings} hotelName={data.hotelInfo.hotelName} canEdit={user.role === "owner"} /></div>
    </main>
  );
}
