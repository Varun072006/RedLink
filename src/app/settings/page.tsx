import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount, NotificationPrefs, ProfileForm } from "@/components/account/account-forms";
import { Card, PageHeader } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { isPushConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

const ROLE_LABEL = { requester: "Requester", donor: "Donor", staff: "Facility staff", admin: "Administrator" } as const;

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="pb-10">
      <PageHeader title="Account and privacy" intro={`${user.email} · ${ROLE_LABEL[user.role]}`} />
      <div className="max-w-xl space-y-5">
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold">Your details</h2>
          <ProfileForm initial={{ displayName: user.displayName, phone: user.phone ?? "" }} />
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold">Notifications</h2>
          <NotificationPrefs
            inApp={user.notifyInApp}
            push={user.notifyPush}
            pushAvailable={isPushConfigured()}
            vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </Card>
        {user.role === "donor" && (
          <Card>
            <h2 className="font-display text-lg font-semibold">Donor consent</h2>
            <p className="mt-1 text-sm text-muted">Opt in or out of requests, and manage your availability and approximate location.</p>
            <Link href="/donor/profile" className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-4">Manage donor profile</Link>
          </Card>
        )}
        <Card>
          <h2 className="font-display text-lg font-semibold">Privacy</h2>
          <p className="mt-1 text-sm text-muted">
            Read how we handle your information in the <Link href="/privacy" className="font-semibold text-forest underline underline-offset-4">privacy notice</Link>.
          </p>
        </Card>
        {user.role !== "admin" && (
          <Card className="border-oxblood/30">
            <h2 className="mb-3 font-display text-lg font-semibold">Delete account</h2>
            <DeleteAccount />
          </Card>
        )}
      </div>
    </div>
  );
}
