import Link from "next/link";
import {
  ArrowRight, BarChart3, BedDouble, Camera, ClipboardCheck, Crown,
  LayoutDashboard, MessagesSquare, Route, Sparkles, SprayCan, UserRound, Wrench,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

function GithubMark({ className }: { className?: string }) {
  return (<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}><path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33C3.9 13.36 3.4 11.9 3.4 11.9c-.36-.91-.87-1.15-.87-1.15-.71-.49.05-.48.05-.48.79.05 1.2.81 1.2.81.7 1.2 1.84.85 2.29.65.07-.51.27-.85.5-1.05-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.11 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z"/></svg>);
}

const GITHUB = "https://github.com/AntonNovozhilov-roof/hotelapp-liveops";

const FEATURES = [
  { icon: MessagesSquare, title: "AI guest assistant", text: "Answers 24/7 in the guest's language, by text or voice, using the hotel's own info and local tips." },
  { icon: Route, title: "Smart task routing", text: "One message becomes tasks for the right team with the right priority: maintenance, housekeeping, front desk, room service." },
  { icon: UserRound, title: "Talk to a person", text: "The AI hands the chat to the front desk when a guest needs a human." },
  { icon: Camera, title: "Photo-proof cleaning", text: "AI compares the cleaner's photo with the room's perfect photo before a supervisor approves with one tap." },
  { icon: BarChart3, title: "Owner reports", text: "Daily and weekly AI reports with occupancy, revenue, problems and suggestions, every number checked against real data." },
  { icon: LayoutDashboard, title: "One place to run the hotel", text: "Rooms and prices, bookings, QR code for every room, team and roles, full history of who did what." },
];

const ROLES = [
  { icon: MessagesSquare, title: "Guests", text: "Chat or speak in any language, 24/7.", href: "/r/204", link: "Chat as a guest" },
  { icon: UserRound, title: "Front desk", text: "Guest messages, requests and handoffs from the AI.", href: "/login", link: "Sign in as Daniyar" },
  { icon: SprayCan, title: "Housekeeping", text: "Cleaning tasks with photo proof.", href: "/login", link: "Sign in as Aigerim" },
  { icon: Wrench, title: "Maintenance", text: "Repairs with proof of the finished work.", href: "/login", link: "Sign in as Ruslan" },
  { icon: ClipboardCheck, title: "Supervisors", text: "One-tap review and full history.", href: "/login", link: "Sign in as Supervisor" },
  { icon: Crown, title: "Owners", text: "Rooms, prices, bookings, team and AI reports.", href: "/login", link: "Sign in as Owner" },
];

const MODELS = [
  ["muse-spark-1.3", "Assistant, routing, photo understanding"],
  ["muse-voice-transcribe-1.0", "Voice"],
  ["sam-3.1", "Finds objects in photos"],
  ["muse-wonder-1.0", "Reports"],
] as const;

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Readybell home" className="flex min-h-11 items-center"><Logo /></Link>
          <div className="ml-auto flex items-center gap-2">
            <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold text-ink-2 hover:bg-canvas" aria-label="Readybell on GitHub">
              <GithubMark className="size-5" /><span className="hidden sm:inline">GitHub</span>
            </a>
            {user ? (
              <Link href={user.home} className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-[14px] font-semibold text-white hover:bg-brand-800">Go to dashboard</Link>
            ) : (
              <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-[14px] font-semibold text-white hover:bg-brand-800">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="overflow-hidden bg-[linear-gradient(180deg,#eaf5f6_0%,#ffffff_78%)]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pb-24 lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 ring-1 ring-brand-100"><Sparkles className="size-3.5" /> Built on Meta AI</p>
              <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[52px]">One app to run your whole hotel.</h1>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-2">Guests, staff, rooms, bookings and reports in one place, with AI that answers guests, sends every job to the right person, checks the work and briefs the owner.</p>
              <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row">
                <Link href="/login" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-[15px] font-semibold text-white hover:bg-brand-800 sm:flex-none sm:px-7">Try the demo <ArrowRight className="size-4" /></Link>
                <Link href="/r/204" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-5 text-[15px] font-semibold text-ink ring-1 ring-line hover:ring-brand-400 sm:flex-none sm:px-7">Chat as a guest</Link>
              </div>
              <p className="mt-3 text-[13px] text-ink-3">No setup needed. Demo accounts are ready.</p>
            </div>
            <div className="relative mx-auto w-full max-w-[560px]" aria-label="Screenshots of the Readybell app">
              <div className="rounded-[22px] border border-line bg-white p-2 shadow-pop sm:mr-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/screenshots/hero-owner.jpg" alt="Owner screen in Readybell, showing today at a glance and hotel pages" width={900} height={563} className="w-full rounded-2xl" loading="eager" />
                <p className="px-2 py-2 text-[12px] font-semibold text-ink-3">Owner screen</p>
              </div>
              <div className="absolute -bottom-8 right-0 w-[42%] max-w-[190px] rounded-[26px] border-[6px] border-brand-950 bg-brand-950 shadow-pop sm:-right-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/screenshots/hero-guest.jpg" alt="Guest chat for room 204 on a phone" width={400} height={768} className="w-full rounded-[20px]" loading="eager" />
              </div>
              <p className="mt-12 text-[12px] font-semibold text-ink-3 sm:ml-2">Guest chat, room 204 · Real screenshots from this demo</p>
            </div>
          </div>
        </section>

        {/* Everyone in your hotel */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-16" aria-labelledby="everyone">
          <h2 id="everyone" className="font-display text-[30px] font-semibold tracking-[-0.01em]">Everyone in your hotel, in one app</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => (
              <Link key={r.title} href={r.href} className="group rounded-xl2 border border-line bg-white p-5 shadow-card transition-colors hover:border-brand-400">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><r.icon className="size-5" /></span>
                <h3 className="mt-3 text-[16px] font-semibold">{r.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{r.text}</p>
                <span className="mt-3 inline-flex min-h-6 items-center gap-1 text-[13.5px] font-semibold text-brand-700 group-hover:underline">{r.link} <ArrowRight className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        </section>

        {/* What the AI does */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="what-ai-does">
          <h2 id="what-ai-does" className="font-display text-[30px] font-semibold tracking-[-0.01em]">What the AI does</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl2 border border-line bg-white p-5 shadow-card">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><f.icon className="size-5" /></span>
                <h3 className="mt-3 text-[16px] font-semibold">{f.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Built on Meta AI */}
        <section className="border-y border-line bg-canvas" aria-labelledby="meta-ai">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="meta-ai" className="font-display text-[24px] font-semibold">Built on Meta AI</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MODELS.map(([name, does]) => (
                <div key={name} className="rounded-xl2 border border-line bg-white p-4">
                  <p className="font-mono text-[13px] font-semibold text-brand-800">{name}</p>
                  <p className="mt-1 text-[13.5px] text-ink-3">{does}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 flex items-start gap-2 text-[15px] font-medium text-ink-2"><BedDouble className="mt-0.5 size-5 shrink-0 text-brand-700" /> People stay in control: AI suggests and prepares, people decide, and every step is logged.</p>
          </div>
        </section>

        {/* Try it */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="try-it">
          <h2 id="try-it" className="font-display text-[30px] font-semibold tracking-[-0.01em]">Try it in 2 minutes</h2>
          <ol className="mt-6 grid gap-3 lg:grid-cols-3">
            <li className="rounded-xl2 border border-line bg-white p-5 shadow-card">
              <p className="font-display text-[14px] font-bold text-brand-700">1</p>
              <h3 className="mt-2 text-[16px] font-semibold">Ask the guest assistant for towels</h3>
              <p className="mt-1 text-[14px] text-ink-3">Open the room 204 guest page and send a request.</p>
              <Link href="/r/204" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-700 px-4 text-[14px] font-semibold text-white hover:bg-brand-800">Open room 204</Link>
            </li>
            <li className="rounded-xl2 border border-line bg-white p-5 shadow-card">
              <p className="font-display text-[14px] font-bold text-brand-700">2</p>
              <h3 className="mt-2 text-[16px] font-semibold">Sign in as Aigerim</h3>
              <p className="mt-1 text-[14px] text-ink-3">Housekeeping sees the new task on her board.</p>
              <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-[14px] font-semibold text-ink ring-1 ring-line hover:ring-brand-400">Sign in as Aigerim</Link>
            </li>
            <li className="rounded-xl2 border border-line bg-white p-5 shadow-card">
              <p className="font-display text-[14px] font-bold text-brand-700">3</p>
              <h3 className="mt-2 text-[16px] font-semibold">Sign in as Owner</h3>
              <p className="mt-1 text-[14px] text-ink-3">See reports, rooms, bookings and the full history.</p>
              <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-[14px] font-semibold text-ink ring-1 ring-line hover:ring-brand-400">Sign in as Owner</Link>
            </li>
          </ol>

          <div className="mt-10 rounded-xl2 border border-dashed border-line bg-canvas p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-3">Coming next <span className="ml-1 rounded-md bg-occ-soft px-2 py-0.5 text-[11px] font-bold text-occ-deep">Not built yet</span></p>
            <p className="mt-2 text-[14.5px] text-ink-2">AI staff scheduling · Telegram notifications for staff · More modules: finance, inventory, integrations</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-6 sm:px-6">
          <Logo small />
          <p className="text-[13px] text-ink-3">The AI operations team for small hotels.</p>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-11 items-center gap-2 text-[13.5px] font-semibold text-brand-700 hover:underline"><GithubMark className="size-4" /> GitHub</a>
        </div>
      </footer>
    </div>
  );
}
