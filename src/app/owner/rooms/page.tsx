import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
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
      <PageHeader title="Rooms & QR codes" sub="One QR code per room. Guests scan it to message the hotel from that room." />
      <div className="mt-5"><RoomsBoard initialRooms={data.rooms.map(publicRoom) as never} initialSettings={data.settings} hotelName={data.hotelInfo.hotelName} canEdit={user.role === "owner"} /></div>
    </main>
  );
}
