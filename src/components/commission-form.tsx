"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import type { Client } from "@prisma/client";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateCommissionAction } from "@/actions/clients";
import type { ActionResult } from "@/types";

export function CommissionForm({ client }: { client: Client }) {
  const action = updateCommissionAction.bind(null, client.id);
  const [state, formAction] = useFormState<ActionResult | null, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  const [enabled, setEnabled] = useState(client.commissionEnabled);
  const [percent, setPercent] = useState(String(client.commissionPercent));

  const dirty = enabled !== client.commissionEnabled || Number(percent) !== client.commissionPercent;

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state && state.ok && state.message && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{state.message}</div>}

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          name="commissionEnabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-brand-600"
        />
        Take a commission on this cafe&apos;s orders
      </label>

      <Field
        label="Commission %"
        error={err.commissionPercent}
        hint="Applied to revenue (subtotal + service charge) on every order"
        className="max-w-[180px]"
      >
        <Input
          name="commissionPercent"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          disabled={!enabled}
        />
      </Field>

      {dirty && (
        <div className="flex justify-end border-t border-ink-100 pt-4">
          <SubmitButton size="sm">Save</SubmitButton>
        </div>
      )}
    </form>
  );
}
