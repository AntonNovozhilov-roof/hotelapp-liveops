import GuestForm from "./GuestForm";
import { Logo, PoweredByReadybell } from "@/components/ui";
import { getRoomByNumber, guestLinkAllowed } from "@/lib/hotel-data";
import { loadDemoHotel } from "@/lib/demo-hotel";
import { isDemoMode } from "@/lib/security";

/**
 * Guest room page in the v1.2 look (D1 / ANT-37): on desktop the page is a
 * centered phone-width frame, like the v1.2 prototype; on a phone it fills
 * the screen. The deep-teal brand-950 header is the v1.2 guest header.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { room } = await params;
  const { t } = await searchParams;
  // DEMO_MODE sandbox: a fresh hotel loads the demo hotel by itself (SEC1).
  const before = await getRoomByNumber(room);
  if (isDemoMode() && before.data.rooms.length === 0) {
    await loadDemoHotel();
  }
  const { room: roomRecord, data } = await getRoomByNumber(room);
  const allowed = guestLinkAllowed(roomRecord, t ?? null, data.settings, data.rooms.length > 0);
  const hotelName = data.hotelInfo.hotelName;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#E9ECEF] md:py-8 flex justify-center">
        <div className="w-full md:w-[400px] min-h-screen md:min-h-0 md:rounded-[28px] md:shadow-pop bg-canvas flex flex-col items-center justify-center px-6 py-16 text-center">
          <Logo />
          <h1 className="mt-6 font-display text-[22px] font-semibold leading-tight">This QR code is no longer valid.</h1>
          <p className="mt-2 text-[14px] text-ink-3">Please contact reception{data.hotelInfo.receptionPhone ? ` at ${data.hotelInfo.receptionPhone}` : ""} and they will help you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E9ECEF] md:py-8 flex justify-center">
      <div className="relative w-full md:w-[400px] min-h-screen md:min-h-0 md:rounded-[28px] md:shadow-pop md:overflow-hidden bg-canvas flex flex-col">
        <header className="relative bg-brand-950 text-white px-5 pt-6 pb-16 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(46,154,168,.45),transparent_70%)]" />
          <div className="relative">
            <Logo light />
          </div>
          <p className="relative text-brand-100/70 text-[13px] mt-7">Welcome to {hotelName}</p>
          <h1 className="relative font-display text-[30px] font-semibold leading-tight">
            Room {room}
          </h1>
          <p className="relative text-[14px] text-brand-100/80 mt-1">
            How can we help?
          </p>
        </header>

        <main className="flex-1 px-4 pb-10 -mt-10 relative">
          <GuestForm room={room} />
          <PoweredByReadybell />
        </main>
      </div>
    </div>
  );
}
