import type { Metadata } from "next";
import { RequestWizard } from "@/components/request/request-wizard";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { loadCentres } from "@/lib/data/centres";
import { isServiceConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Request blood" };

export default async function RequestBloodPage() {
  const { centres, mode } = await loadCentres();
  const real = centres.filter((c) => !c.isSynthetic);
  const byCity = new Map<string, { lat: number; lng: number; n: number }>();
  for (const c of centres) {
    const cur = byCity.get(c.city) ?? { lat: 0, lng: 0, n: 0 };
    byCity.set(c.city, { lat: cur.lat + c.lat, lng: cur.lng + c.lng, n: cur.n + 1 });
  }
  const cities = [...byCity.entries()].map(([city, v]) => ({ city, lat: v.lat / v.n, lng: v.lng / v.n }));
  return (
    <div className="pb-10">
      <PageHeader title="Request blood" intro="Four short steps. You do not need an account, and you will get a private link to track progress." />
      <div className="mx-auto max-w-xl space-y-5">
        <Notice tone="warn" title="Call the treating hospital first">
          If the situation is urgent, contact the hospital or an authorized blood bank now. REDLINK widens the search but cannot guarantee stock.
        </Notice>
        {mode === "demo" && <Notice tone="demo" title="Demonstration mode">No backend is connected, so submissions are disabled.</Notice>}
        <RequestWizard
          centres={real.map((c) => ({ id: c.id, name: c.name, city: c.city, lat: c.lat, lng: c.lng }))}
          cities={cities}
          enabled={isServiceConfigured()}
        />
      </div>
    </div>
  );
}
