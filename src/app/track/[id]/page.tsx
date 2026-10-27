import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/request/track-view";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { isServiceConfigured } from "@/lib/env";
import { isPlausibleToken } from "@/lib/domain/tracking";
import { getTrackingView } from "@/lib/server/request-service";

export const metadata: Metadata = { title: "Track request", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function TrackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!isPlausibleToken(id)) notFound();
  if (!isServiceConfigured()) {
    return (
      <div className="pb-10">
        <PageHeader title="Track request" />
        <Notice tone="warn" title="Backend not configured">Tracking needs the backend. Contact the treating facility directly.</Notice>
      </div>
    );
  }
  const view = await getTrackingView(id, { maintain: true });
  if (!view) notFound();
  return (
    <div className="pb-10">
      <PageHeader title="Track your request" intro="This page updates automatically while it is open." />
      <div className="mx-auto max-w-xl">
        <TrackView token={id} initial={view} isNew={isNew === "1"} />
      </div>
    </div>
  );
}
