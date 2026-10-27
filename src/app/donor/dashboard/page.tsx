import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, Phone } from "lucide-react";
import { AvailabilityControl, RespondButtons } from "@/components/donor/donor-controls";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { COMPONENT_LABELS, URGENCY_LABELS, type BloodComponent, type Urgency } from "@/lib/domain/blood";
import { approxDistanceLabel } from "@/lib/domain/distance";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Donor dashboard" };

interface MatchRow {
  match_id: string;
  match_status: string;
  request_status: string;
  blood_group: string;
  component: BloodComponent;
  units: number;
  urgency: Urgency;
  city: string;
  facility_name: string;
  distance_km: number;
  expires_at: string;
  notified_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  location_detail: string | null;
}

const CLOSED = ["fulfilled", "cancelled", "expired", "rejected", "unresolved"];

export default async function DonorDashboard() {
  const user = await requireRole(["donor"], "/donor/dashboard");
  const supabase = await createServerSupabase();
  const [{ data: profile }, { data: matchData }, { data: donations }] = await Promise.all([
    supabase.from("donor_profiles").select("blood_group,availability,opted_in,city,donor_code,last_donation_on").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("donor_matches"),
    supabase.from("donation_records").select("id,donated_on,verified").order("donated_on", { ascending: false }),
  ]);
  const matches = (matchData ?? []) as MatchRow[];
  const now = new Date().getTime();
  const open = matches.filter((m) => m.match_status === "notified" && !CLOSED.includes(m.request_status) && new Date(m.expires_at).getTime() > now);
  const accepted = matches.filter((m) => m.match_status === "accepted" && !CLOSED.includes(m.request_status));
  const history = matches.filter((m) => !open.includes(m) && !accepted.includes(m));

  return (
    <div className="pb-10">
      <LiveRefresh channel={`donor-${user.id}`} table="request_matches" filter={`donor_id=eq.${user.id}`} />
      <PageHeader title="Donor dashboard" intro={`Welcome${user.displayName ? `, ${user.displayName}` : ""}. You decide when you can be contacted.`} />
      <div className="space-y-5">
        {!profile ? (
          <EmptyState
            title="Set up your donor profile"
            action={<LinkButton href="/donor/profile" variant="forest">Create profile</LinkButton>}
          >
            Add your self-reported blood group and approximate location, then opt in if you would like to hear about nearby requests.
          </EmptyState>
        ) : (
          <>
            <Card>
              <h2 className="font-display text-lg font-semibold">Availability</h2>
              <p className="mb-3 mt-1 text-sm text-muted">
                {profile.blood_group} · {profile.city} · {profile.opted_in ? "Opted in to requests" : "Not opted in"}
              </p>
              <AvailabilityControl current={profile.availability} canBeAvailable={profile.opted_in} />
            </Card>

            <Notice tone="info" title="What accepting means">
              Saying you are willing shares your interest only. It does not confirm medical eligibility or that blood is available. A qualified professional screens every donor.
            </Notice>

            <section aria-labelledby="open">
              <h2 id="open" className="mb-3 font-display text-xl font-semibold">Nearby requests</h2>
              {open.length === 0 ? (
                <EmptyState title="No open requests right now">
                  {profile.availability === "available" ? "You will be notified here and in Alerts when a compatible request is nearby." : "Set yourself as available to receive requests."}
                </EmptyState>
              ) : (
                <ul className="space-y-3">
                  {open.map((m) => (
                    <li key={m.match_id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          {m.units} unit(s) · {m.blood_group} · {COMPONENT_LABELS[m.component]}
                        </p>
                        <Badge tone={m.urgency === "critical" ? "bad" : "warn"}>{URGENCY_LABELS[m.urgency]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {m.facility_name}, {m.city} · {approxDistanceLabel(Number(m.distance_km))} away
                      </p>
                      <p className="mb-3 mt-1 text-xs text-muted">Respond by {new Date(m.expires_at).toLocaleString()}</p>
                      <RespondButtons matchId={m.match_id} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {accepted.length > 0 && (
              <section aria-labelledby="accepted">
                <h2 id="accepted" className="mb-3 font-display text-xl font-semibold">You said you are willing</h2>
                <ul className="space-y-3">
                  {accepted.map((m) => (
                    <li key={m.match_id} className="rounded-[var(--radius-card)] border border-forest/40 bg-paper p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold"><HeartHandshake size={16} aria-hidden className="text-forest" /> {m.units} unit(s) · {m.blood_group} at {m.facility_name}, {m.city}</p>
                      {m.contact_phone && (
                        <p className="mt-2">
                          Coordinator: {m.contact_name}{" "}
                          <a href={`tel:${m.contact_phone}`} className="inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-4"><Phone size={14} aria-hidden />{m.contact_phone}</a>
                          {m.location_detail && <span className="block text-muted">{m.location_detail}</span>}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted">Show your donor code <strong className="font-mono">{profile.donor_code}</strong> to facility staff so a verified donation can be recorded.</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="history" className="grid gap-5 md:grid-cols-2">
              <Card>
                <h2 id="history" className="font-display text-lg font-semibold">Response history</h2>
                {history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No past responses yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {history.slice(0, 8).map((m) => (
                      <li key={m.match_id} className="flex items-center justify-between gap-2 py-2">
                        <span>{m.blood_group} · {m.facility_name}</span>
                        <Badge tone={m.match_status === "accepted" ? "good" : "neutral"}>{m.match_status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold">Verified donations</h2>
                <p className="mt-1 text-xs text-muted">Only donations recorded by verified facility staff appear here.</p>
                {(donations ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted">None recorded yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {(donations ?? []).slice(0, 8).map((d) => (
                      <li key={d.id} className="py-2">{new Date(d.donated_on).toLocaleDateString()}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted">Your donor code: <strong className="font-mono">{profile.donor_code}</strong></p>
              </Card>
            </section>
            <p className="text-sm">
              <Link href="/donor/profile" className="font-medium text-forest underline underline-offset-4">Edit profile, consent and privacy preferences</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
