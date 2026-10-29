import type { Metadata } from "next";
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
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
