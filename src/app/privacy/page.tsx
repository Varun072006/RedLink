import type { Metadata } from "next";
import { ProsePage } from "@/components/ui/prose-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy notice"
      intro="This is the design intent for REDLINK's data handling. It will be finalized with legal review before any public launch."
    >
      <section>
        <h2>What we collect</h2>
        <p>
          Account details, a self-reported blood group for donors, request details you submit, and the contact
          information needed to coordinate a request. We avoid collecting medical history.
        </p>
      </section>
      <section>
        <h2>What stays private</h2>
        <p>
          Donor contact details and precise locations are never shown in public search. Donors only see approximate
          distance to a request, and requesters only see a donor&apos;s details if the donor agrees.
        </p>
      </section>
      <section>
        <h2>Your controls</h2>
        <p>
          Donors opt in explicitly, can pause or withdraw at any time, and can manage notification preferences in
          settings.
        </p>
      </section>
    </ProsePage>
  );
}
