import Link from "next/link";
import StaffBoard from "./StaffBoard";
import { Logo } from "@/components/ui";

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <Link
            href="/r/204"
            className="text-[13.5px] font-semibold text-brand-700 hover:underline"
          >
            Open guest page (Room 204)
          </Link>
        </div>
        <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.01em] leading-tight">
          Staff tasks
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-3">
          Choose your name, then move your team tasks forward: Accept, Start,
          add a photo, Send to review. A supervisor approves it to Done.
        </p>
      </header>

      <StaffBoard />
    </main>
  );
}
