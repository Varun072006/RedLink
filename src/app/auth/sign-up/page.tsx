import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";
import { SetupNotice } from "@/components/ui/feedback";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      intro="You do not need an account to search availability or submit an emergency request."
      footer={
        <>
          Already registered? <Link href="/auth/sign-in" className="font-medium text-forest underline underline-offset-4">Sign in</Link>
        </>
      }
    >
      {!isSupabaseConfigured() && <SetupNotice />}
      <SignUpForm initialRole={role} />
    </AuthCard>
  );
}
