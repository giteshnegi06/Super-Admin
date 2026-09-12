"use client";

import { useFormState } from "react-dom";
import { loginAction } from "@/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/types";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState<ActionResult | null, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {state && !state.ok && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{state.error}</div>}
      <Field label="Email"><Input name="email" type="email" autoComplete="email" placeholder="you@chotu.app" required autoFocus /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required /></Field>
      <SubmitButton className="w-full" variant="dark">Continue</SubmitButton>
    </form>
  );
}
