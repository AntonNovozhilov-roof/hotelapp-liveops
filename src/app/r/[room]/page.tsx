import GuestForm from "./GuestForm";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">
          HotelApp LiveOps
        </p>
        <h1 className="mt-2 text-3xl font-bold">Room {room}</h1>
        <p className="mt-2 text-slate-600">
          Write your request. We will send it to the right hotel team.
        </p>
      </header>

      <GuestForm room={room} />
    </main>
  );
}
