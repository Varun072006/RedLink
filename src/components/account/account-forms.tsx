"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { BellRing, CheckCheck } from "lucide-react";
import {
  deleteAccountAction,
  markNotificationsReadAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  setNotificationPrefsAction,
  updateProfileAction,
} from "@/actions/account";
import { profileSettingsSchema } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

type ProfileValues = z.infer<typeof profileSettingsSchema>;

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSettingsSchema), defaultValues: initial });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        const res = await updateProfileAction(v);
        toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Saved.") : res.error);
        router.refresh();
      })}
    >
      <Field label="Name" htmlFor="displayName" error={errors.displayName?.message}>
        <Input id="displayName" autoComplete="name" aria-invalid={!!errors.displayName} {...register("displayName")} />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={errors.phone?.message}>
        <Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <Button type="submit" variant="forest" loading={isSubmitting}>Save details</Button>
    </form>
  );
}

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationPrefs({ inApp, push, pushAvailable, vapidKey }: { inApp: boolean; push: boolean; pushAvailable: boolean; vapidKey: string }) {
  const router = useRouter();
  const toast = useToast();
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => false,
  );
  const blocked = useSyncExternalStore(
    () => () => undefined,
    () => "Notification" in window && Notification.permission === "denied",
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const denied = blocked || refused;

  async function toggleInApp(v: boolean) {
    setBusy(true);
    const res = await setNotificationPrefsAction(v, push && v);
    setBusy(false);
    toast.push(res.ok ? "success" : "error", res.ok ? "Preferences saved." : res.error);
    router.refresh();
  }

  async function togglePush(enable: boolean) {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (enable) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setRefused(true);
          toast.push("error", "Notification permission was not granted. In-app alerts still work.");
          return;
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidKey) });
        const j = sub.toJSON();
        const res = await savePushSubscriptionAction({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" });
        toast.push(res.ok ? "success" : "error", res.ok ? "Push notifications enabled on this device." : res.error);
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscriptionAction(sub.endpoint);
          await sub.unsubscribe();
        }
        await setNotificationPrefsAction(inApp, false);
        toast.push("success", "Push notifications turned off.");
      }
    } catch {
      toast.push("error", "Push could not be changed on this device. In-app alerts still work.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-forest" checked={inApp} disabled={busy} onChange={(e) => void toggleInApp(e.target.checked)} />
        <span><strong>In-app notifications</strong><span className="block text-muted">Request updates appear in your notification centre.</span></span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-forest"
          checked={push}
          disabled={busy || !pushAvailable || !supported || denied || !inApp}
          onChange={(e) => void togglePush(e.target.checked)}
        />
        <span>
          <strong className="flex items-center gap-1.5"><BellRing size={14} aria-hidden /> Push notifications on this device</strong>
          <span className="block text-muted">
            {!pushAvailable ? "Not enabled on this deployment." : !supported ? "This browser does not support push. In-app alerts still work." : denied ? "Blocked in your browser settings. In-app alerts still work." : "Optional. Sends a short alert when something needs your attention."}
          </span>
        </span>
      </label>
    </div>
  );
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={async () => {
        await markNotificationsReadAction();
        router.refresh();
      }}
    >
      <CheckCheck size={14} aria-hidden /> Mark all read
    </Button>
  );
}

export function MarkRead({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs font-semibold text-forest underline underline-offset-4"
      onClick={async () => {
        await markNotificationsReadAction(id);
        router.refresh();
      }}
    >
      Mark read
    </button>
  );
}

export function DeleteAccount() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <Notice tone="warn" title="This is permanent">
        Your account, donor profile and notifications are deleted. Requests you submitted are kept without your account link, and audit entries are retained.
      </Notice>
      <Field label="Type DELETE to confirm" htmlFor="del-confirm">
        <Input id="del-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </Field>
      <Button
        variant="danger"
        loading={busy}
        disabled={text.trim().toUpperCase() !== "DELETE"}
        onClick={async () => {
          setBusy(true);
          const res = await deleteAccountAction(text);
          setBusy(false);
          if (res && !res.ok) toast.push("error", res.error);
        }}
      >
        Delete my account
      </Button>
    </div>
  );
}
