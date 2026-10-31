import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotelApp LiveOps",
  description: "Guest requests turned into tasks for hotel teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {!process.env.MODEL_API_KEY && (
          <div className="bg-brass-soft px-4 py-2 text-center text-[12.5px] font-semibold text-brass-deep" role="status">
            MOCK mode — no MODEL_API_KEY set, so AI answers, photo checks and reports are clearly marked MOCK examples. Everything still works; voice transcription needs a key. See the README to switch on real AI.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
