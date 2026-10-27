import type { Metadata } from "next";
import { DonorProfileForm } from "@/components/donor/donor-profile-form";
import { PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { loadCentres } from "@/lib/data/centres";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BloodGroup } from "@/lib/domain/blood";

export const metadata: Metadata = { title: "Donor profile" };

export default async function DonorProfilePage() {
  const user = await requireRole(["donor"], "/donor/profile");
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("donor_profiles").select("*").eq("user_id", user.id).maybeSingle();
  const { centres } = await loadCentres();
  const by = new Map<string, { lat: number; lng: number; n: number }>();
  for (const c of centres) {
    const cur = by.get(c.city) ?? { lat: 0, lng: 0, n: 0 };
    by.set(c.city, { lat: cur.lat + c.lat, lng: cur.lng + c.lng, n: cur.n + 1 });
  }
  const cities = [...by.entries()].map(([city, v]) => ({ city, lat: v.lat / v.n, lng: v.lng / v.n }));
  return (
    <div className="pb-10">
      <PageHeader title="Donor profile" intro="Control what REDLINK knows about you and when you can be contacted." />
      <div className="max-w-xl">
        <DonorProfileForm
          cities={cities}
          initial={
            data
              ? {
                  bloodGroup: data.blood_group as BloodGroup,
                  city: data.city,
                  lat: Number(data.lat),
                  lng: Number(data.lng),
                  lastDonationOn: data.last_donation_on ?? "",
                  optedIn: data.opted_in,
                  availability: data.availability,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
