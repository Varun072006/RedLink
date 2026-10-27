"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { forgotPasswordAction, signInAction, signUpAction, updatePasswordAction } from "@/actions/auth";
import { forgotSchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";

type Apply = (errors: Record<string, string> | undefined) => void;

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const apply: Apply = (fe) => Object.entries(fe ?? {}).forEach(([k, m]) => setFieldError(k as "email", { message: m }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await signInAction(values, next);
        if (!res.ok) {
          setError(res.error);
          apply(res.fieldErrors);
          return;
        }
        router.push(res.data!.redirectTo);
        router.refresh();
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={describedBy("email", undefined, errors.email?.message)} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={describedBy("password", undefined, errors.password?.message)} {...register("password")} />
      </Field>
      <Button type="submit" variant="forest" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

const ROLE_OPTIONS = [
  { value: "requester", title: "I need blood", body: "Request blood and track progress." },
  { value: "donor", title: "I want to donate", body: "Opt in to nearby requests." },
  { value: "staff", title: "Hospital or blood bank", body: "Register a facility for verification." },
] as const;

export function SignUpForm({ initialRole }: { initialRole?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { needsConfirmation: boolean }>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", role: ROLE_OPTIONS.some((r) => r.value === initialRole) ? (initialRole as "donor") : "requester" },
  });

  if (done) {
    return done.needsConfirmation ? (
      <Notice tone="success" title="Check your email">
        We sent a confirmation link. Open it to activate your account, then sign in.
      </Notice>
    ) : (
      <Notice tone="success" title="Account created">
        <Button variant="forest" size="sm" className="mt-2" onClick={() => router.push("/auth/sign-in")}>
          Continue to sign in
        </Button>
      </Notice>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await signUpAction(values);
        if (!res.ok) {
          setError(res.error);
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setFieldError(k as "email", { message: m }));
          return;
        }
        setDone(res.data!);
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Account type</legend>
        {ROLE_OPTIONS.map((r) => (
          <label key={r.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-paper p-3 has-[:checked]:border-forest has-[:checked]:bg-[#e8f0ec] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest">
            <input type="radio" value={r.value} className="mt-1 accent-forest" {...register("role")} />
            <span>
              <span className="block text-sm font-semibold">{r.title}</span>
              <span className="block text-xs text-muted">{r.body}</span>
            </span>
          </label>
        ))}
        {errors.role && <p role="alert" className="text-xs font-medium text-oxblood">{errors.role.message}</p>}
      </fieldset>
      <Field label="Full name" htmlFor="displayName" error={errors.displayName?.message}>
        <Input id="displayName" autoComplete="name" aria-invalid={!!errors.displayName} {...register("displayName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters." error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <p className="text-xs text-muted">
        Hospital and blood-bank accounts cannot confirm stock until an administrator verifies the facility. Administrator access cannot be requested here.
      </p>
      <Button type="submit" variant="forest" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await forgotPasswordAction(values);
        if (res.ok) setMsg(res.message ?? "Check your email.");
        else setError(res.error);
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {msg && <Notice tone="success">{msg}</Notice>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Button type="submit" variant="forest" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof newPasswordSchema>>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "" } });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await updatePasswordAction(values);
        if (!res.ok) return setError(res.error);
        router.push("/");
        router.refresh();
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="New password" htmlFor="password" hint="At least 10 characters." error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Button type="submit" variant="forest" className="w-full" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
