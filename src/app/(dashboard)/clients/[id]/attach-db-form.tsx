"use client";

import { useFormState } from "react-dom";
import { attachDatabaseAction } from "@/actions/clients";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/types";

export function AttachDbForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState<ActionResult | null, FormData>(attachDatabaseAction.bind(null, clientId), null);
  return (
    <form action={action} className="flex items-start gap-2">
      <div className="flex-1">
        <Input name="dbName" placeholder='Existing database name, e.g. "QR-Order"' required />
        {state && <div className={`mt-1 text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.ok ? state.message : state.error}</div>}
      </div>
      <SubmitButton size="sm" variant="secondary">Link database</SubmitButton>
    </form>
  );
}
