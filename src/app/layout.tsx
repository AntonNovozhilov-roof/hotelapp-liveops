import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Readybell", template: "%s · Readybell" },
  description: "Readybell — guest requests turned into tasks for hotel teams.",
  icons: {
    icon: [{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/readybell-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {!process.env.MODEL_API_KEY && (
          <div className="bg-brass-soft px-4 py-2 text-center text-[12.5px] font-semibold text-brass-deep" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/readybell-mark.svg" alt="" width={14} height={14} className="mr-1 inline-block align-[-2px]" aria-hidden />
            Readybell · MOCK mode — no MODEL_API_KEY set, so AI answers, photo checks and reports are clearly marked MOCK examples. Everything still works; voice transcription needs a key. See the README to switch on real AI.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
