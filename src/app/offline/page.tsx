import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <WifiOff size={32} strokeWidth={1.5} className="mx-auto text-oxblood" aria-hidden />
      <h1 className="mt-4 font-display text-3xl font-semibold">You are offline</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal/80">
        REDLINK needs a connection to show current availability and request status. Nothing is shown from memory because stock figures go out of date quickly.
      </p>
      <p className="mt-3 text-sm font-semibold">In an emergency, call the treating hospital or an authorized blood bank directly.</p>
    </div>
  );
}
