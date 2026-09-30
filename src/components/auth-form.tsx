"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/lib/auth/actions";

type Field = { name: string; label: string; type: string; autoComplete: string };

type Props = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  initialError?: string;
};

export function AuthForm({ action, fields, submitLabel, initialError }: Props) {
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
            className="rounded border border-stone-300 bg-white px-3 py-2 text-base font-normal"
          />
        </label>
      ))}
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Bitte warten …" : submitLabel}
      </button>
    </form>
  );
}
