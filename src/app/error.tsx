"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm text-charcoal/80">We could not load this page. No changes were lost. If this is urgent, contact the treating facility directly.</p>
      <Button variant="forest" className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
