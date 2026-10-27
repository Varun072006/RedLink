import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import { Notice, SetupNotice } from "@/components/ui/feedback";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  suspended: "This account has been suspended. Contact the platform administrators.",
  link: "That link is invalid or has expired. Request a new one.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user && user.status === "active" && !error) redirect(safeNext(next, homeFor(user.role)));
  return (
    <AuthCard
      title="Sign in"
      intro="Access your donor, facility or administrator workspace."
      footer={
        <>
          New to REDLINK? <Link href="/auth/sign-up" className="font-medium text-forest underline underline-offset-4">Create an account</Link>
        </>
      }
    >
      {!isSupabaseConfigured() && <SetupNotice />}
      {error && ERRORS[error] && <Notice tone="warn">{ERRORS[error]}</Notice>}
      <SignInForm next={safeNext(next, "") || undefined} />
      <p className="text-center text-sm">
        <Link href="/auth/forgot-password" className="text-forest underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </AuthCard>
  );
}
