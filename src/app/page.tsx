import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-5 py-10">
      <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">
          HotelApp LiveOps
        </p>
        <h1 className="mt-3 text-3xl font-bold">Guest requests, routed by AI</h1>
        <p className="mt-3 text-slate-600">
          Demo start page. In the hotel, each room has a QR code that opens its
          own guest page.
        </p>
        <Link
          href="/r/204"
          className="mt-6 inline-block rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
        >
          Open Room 204 guest page
        </Link>
      </div>
    </main>
  );
}
