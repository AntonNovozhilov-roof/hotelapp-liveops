import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import GuestMessagesBoard from "@/components/GuestMessagesBoard";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

/** Guest messages (G3): front desk, supervisor and owner only. */
export default async function GuestMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["front_desk", "supervisor", "owner"].includes(user.role)) redirect(user.home);
  return (
    <main className="app-main mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title="Guest messages" sub="Guests who asked for a person, or who the assistant could not help. The assistant stays quiet while you are in a chat." />
      <div className="mt-5"><GuestMessagesBoard /></div>
    </main>
  );
}
