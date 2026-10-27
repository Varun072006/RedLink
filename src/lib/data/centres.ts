import "server-only";
import type { SearchableCentre } from "@/lib/domain/availability";
import { demoCentres } from "@/lib/demo/seed";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BloodComponent, BloodGroup } from "@/lib/domain/blood";

export interface CentreData {
  centres: SearchableCentre[];
  mode: "live" | "demo";
  failed: boolean;
}

export async function loadCentres(): Promise<CentreData> {
  if (!isSupabaseConfigured()) return { centres: demoCentres(), mode: "demo", failed: false };
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("blood_centres")
      .select("id,name,kind,city,address,phone,lat,lng,is_synthetic,verification_status,blood_inventory(blood_group,component,units,reserved,last_confirmed_at)")
      .eq("verification_status", "verified")
      .order("name");
    if (error) throw error;
    return {
      mode: "live",
      failed: false,
      centres: (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        city: c.city,
        address: c.address,
        phone: c.phone,
        lat: Number(c.lat),
        lng: Number(c.lng),
        isSynthetic: c.is_synthetic,
        stock: (c.blood_inventory ?? []).map((i) => ({
          bloodGroup: i.blood_group as BloodGroup,
          component: i.component as BloodComponent,
          units: i.units,
          reserved: i.reserved,
          confirmedAt: i.last_confirmed_at,
        })),
      })),
    };
  } catch {
    return { centres: [], mode: "live", failed: true };
  }
}
