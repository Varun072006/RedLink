import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { SetupNotice } from "@/components/ui/feedback";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your email and we will send a reset link."
      footer={<Link href="/auth/sign-in" className="font-medium text-forest underline underline-offset-4">Back to sign in</Link>}
    >
      {!isSupabaseConfigured() && <SetupNotice />}
      <ForgotPasswordForm />
    </AuthCard>
  );
}
