import RestoreForm from "./RestoreForm";
import { PageHeader } from "@/components/ui";

/**
 * /admin/restore — secret wipe + fresh demo (ANT-27 follow-up).
 * Deliberately NOT linked from any page or menu: you have to know the
 * address, and knowing the address is not enough — the server checks
 * RESTORE_SECRET. No sign-in is required or accepted as a substitute.
 */
export default function AdminRestorePage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Restore clean demo"
        sub="Deletes ALL hotel data on this copy (tasks, photos, history, reports, conversations, bookings, rooms, hotel info, team accounts, counters) and loads a fresh demo hotel. Demo accounts stay as they are."
      />
      <div className="mt-5">
        <RestoreForm />
      </div>
    </main>
  );
}
