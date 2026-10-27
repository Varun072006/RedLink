import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";

export interface MyCentre {
  id: string;
  name: string;
  kind: "hospital" | "blood_bank";
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  license_ref: string | null;
  verification_status: "pending" | "verified" | "rejected" | "suspended";
  verification_note: string | null;
  verified_at: string | null;
  is_synthetic: boolean;
  staff_role: "owner" | "staff";
}

export const getMyCentre = cache(async (): Promise<MyCentre | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("my_centre");
  return (data as MyCentre | null) ?? null;
});
