import GuestForm from "./GuestForm";
import { Logo } from "@/components/ui";

/**
 * Guest room page in the v1.2 look (D1 / ANT-37): on desktop the page is a
 * centered phone-width frame, like the v1.2 prototype; on a phone it fills
 * the screen. The deep-teal brand-950 header is the v1.2 guest header.
 */
export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;

  return (
    <div className="min-h-screen bg-[#E9ECEF] md:py-8 flex justify-center">
      <div className="relative w-full md:w-[400px] min-h-screen md:min-h-0 md:rounded-[28px] md:shadow-pop md:overflow-hidden bg-canvas flex flex-col">
        <header className="relative bg-brand-950 text-white px-5 pt-6 pb-16 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(46,154,168,.45),transparent_70%)]" />
          <div className="relative">
            <Logo light />
          </div>
          <p className="relative text-brand-100/70 text-[13px] mt-7">Welcome</p>
          <h1 className="relative font-display text-[30px] font-semibold leading-tight">
            Room {room}
          </h1>
          <p className="relative text-[14px] text-brand-100/80 mt-1">
            How can we help?
          </p>
        </header>

        <main className="flex-1 px-4 pb-10 -mt-10 relative">
          <GuestForm room={room} />
        </main>
      </div>
    </div>
  );
}
