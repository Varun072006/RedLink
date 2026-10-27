"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";
import type { MapPoint } from "./availability-map";

const Map = dynamic(() => import("./availability-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full md:h-[480px]" />,
});

export function MapLoader(props: { points: MapPoint[]; origin: { lat: number; lng: number } | null }) {
  return <Map {...props} />;
}
