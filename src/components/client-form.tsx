"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import type { Client } from "@prisma/client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { slugify } from "@/lib/validations";
import { CURRENCIES, TIME_ZONES } from "@/lib/currencies";
import { createClientAction, updateClientAction } from "@/actions/clients";
import type { ActionResult } from "@/types";

export function ClientForm({ client }: { client?: Client }) {
  const isEdit = !!client;
  const action = isEdit ? updateClientAction.bind(null, client.id) : createClientAction;
  const [state, formAction] = useFormState<ActionResult | null, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  const [slug, setSlug] = useState(client?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {state && state.ok && state.message && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">{state.message}</div>}

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Cafe</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cafe name" error={err.cafeName}>
            <Input name="cafeName" defaultValue={client?.cafeName} required
              onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }} />
          </Field>
          <Field label="Slug (URL)" error={err.slug} hint={isEdit ? "Cannot be changed after creation" : "order.app/<slug>"}>
            <Input name="slug" value={slug} disabled={isEdit} required pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} />
          </Field>
          <Field label="Tagline" error={err.tagline} className="sm:col-span-2" hint="Shown under the cafe name in the app">
            <Input name="tagline" defaultValue={client?.tagline ?? ""} placeholder="Artisanal Brews & Gourmet Kitchen" />
          </Field>
          <Field label="Address" error={err.address} className="sm:col-span-2">
            <Input name="address" defaultValue={client?.address ?? ""} />
          </Field>
          <Field label="City" error={err.city}><Input name="city" defaultValue={client?.city ?? ""} /></Field>
          <Field label="State / Region" error={err.state}><Input name="state" defaultValue={client?.state ?? ""} /></Field>
          <Field label="Country" error={err.country}><Input name="country" defaultValue={client?.country ?? "India"} /></Field>
          <Field label="Tax ID (GST / VAT / TRN)" error={err.gstNumber}><Input name="gstNumber" defaultValue={client?.gstNumber ?? ""} /></Field>
          <Field label="Currency" error={err.currency} hint="Shown on the menu and bills in the app — saved changes apply immediately">
            <Select name="currency" defaultValue={client?.currency ?? "INR"}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.symbol.trim()} · {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Time zone" error={err.timeZone} hint="Used for daily revenue day boundaries">
            <Input name="timeZone" list="tz-list" defaultValue={client?.timeZone ?? "Asia/Kolkata"} />
            <datalist id="tz-list">{TIME_ZONES.map((z) => <option key={z} value={z} />)}</datalist>
          </Field>
          <Field label={isEdit ? "Tables (initial)" : "Number of tables"} error={err.initialTables} hint={isEdit ? "Actual count comes from the cafe database" : "Created as Table 01, Table 02, ..."}>
            <Input name="initialTables" type="number" min={0} max={200} defaultValue={client?.initialTables ?? 10} />
          </Field>
          <Field label="App URL" error={err.appUrl} className="sm:col-span-2" hint="Vercel deployment of QR-Ordering for this cafe, e.g. https://negis-kitchen.vercel.app">
            <Input name="appUrl" type="url" defaultValue={client?.appUrl ?? ""} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Owner</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner name" error={err.ownerName}><Input name="ownerName" defaultValue={client?.ownerName} required /></Field>
          <Field label="Owner email" error={err.ownerEmail} hint="Used as the cafe dashboard login">
            <Input name="ownerEmail" type="email" defaultValue={client?.ownerEmail} required />
          </Field>
          <Field label="Phone" error={err.ownerPhone}><Input name="ownerPhone" defaultValue={client?.ownerPhone ?? ""} /></Field>
        </div>
      </section>

      <Field label="Internal notes" error={err.notes}><Textarea name="notes" defaultValue={client?.notes ?? ""} /></Field>

      {!isEdit && (
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="provisionNow" defaultChecked className="h-4 w-4 rounded border-ink-300 text-brand-600" />
          Provision this cafe in the shared database right away
        </label>
      )}

      <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
        <SubmitButton>{isEdit ? "Save changes" : "Create cafe"}</SubmitButton>
      </div>
    </form>
  );
}
