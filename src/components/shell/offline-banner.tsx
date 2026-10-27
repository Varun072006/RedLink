"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-charcoal px-4 py-2 text-center text-sm text-ivory">
      <WifiOff size={16} aria-hidden /> You are offline. Availability and request information may be out of date. In an emergency, call the facility.
    </div>
  );
}
