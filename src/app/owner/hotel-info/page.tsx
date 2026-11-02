import { redirect } from "next/navigation";
import SessionBar from "@/components/SessionBar";
import { PageHeader } from "@/components/ui";
import HotelInfoForm from "@/components/HotelInfoForm";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData } from "@/lib/hotel-data";

export default async function HotelInfoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect(user.home);
  const data = await getHotelData();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <SessionBar user={user} />
      <PageHeader title="Hotel info" sub="What guests can ask the assistant about. Only you (the Owner) can change this." />
      <div className="mt-5"><HotelInfoForm initial={data.hotelInfo} initialCurrency={data.settings.currency} /></div>
    </main>
  );
}
