import type { Metadata } from "next";
import { ProsePage } from "@/components/ui/prose-page";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ProsePage
      title="About REDLINK"
      intro="REDLINK is a coordination layer between people who need blood, voluntary donors, and verified blood centres."
    >
      <section>
        <h2>What it does</h2>
        <p>
          It lets you search blood availability, submit an emergency request, and follow its progress. Centres
          confirm stock with a timestamp, and donors can opt in to hear about nearby requests.
        </p>
      </section>
      <section>
        <h2>What it does not do</h2>
        <p>
          REDLINK does not verify donor medical eligibility, decide clinical compatibility, or guarantee that blood
          will be available. Testing, crossmatching and transfusion decisions belong to qualified healthcare
          professionals.
        </p>
      </section>
      <section>
        <h2>Demonstration data</h2>
        <p>
          Until real facilities are onboarded and verified, any records shown are synthetic and labelled as such.
          No partnerships or real stock levels are implied.
        </p>
      </section>
    </ProsePage>
  );
}
