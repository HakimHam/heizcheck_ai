"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/lib/auth/actions";

type Field = { name: string; label: string; type: string; autoComplete: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
  alternative,
  initialError,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  alternative: { text: string; linkLabel: string; href: string };
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: initialError });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm font-medium">
          {f.label}
          <input
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            required
            className="rounded border border-border bg-background px-3 py-2 text-base font-normal"
          />
        </label>
      ))}
      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Bitte warten …" : submitLabel}
      </button>
      <p className="text-sm text-muted">
        {alternative.text}{" "}
        <Link href={alternative.href} className="underline">
          {alternative.linkLabel}
        </Link>
      </p>
    </form>
  );
}
