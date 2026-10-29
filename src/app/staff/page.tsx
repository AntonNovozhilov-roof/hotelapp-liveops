import Link from "next/link";
import StaffBoard from "./StaffBoard";

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">
          HotelApp LiveOps
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold">Staff tasks</h1>
          <Link
            href="/r/204"
            className="font-semibold text-teal-800 underline underline-offset-4"
          >
            Open guest page (Room 204)
          </Link>
        </div>
        <p className="mt-2 text-slate-600">
          Choose your name, then move your team tasks forward: Accept, Start,
          Done.
        </p>
      </header>

      <StaffBoard />
    </main>
  );
}
