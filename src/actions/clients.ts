"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole, logActivity } from "@/lib/auth";
import { createClientSchema, updateClientSchema, commissionSchema } from "@/lib/validations";
import { provisionClient, deprovisionClient, attachExistingDatabase, resetOwnerPassword } from "@/lib/provisioning";
import type { ActionResult } from "@/types";

function clean<T extends Record<string, unknown>>(obj: T) {
  // Convert "" -> null so optional fields are stored as NULL
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])) as T;
}

/** Create a client row and (optionally) kick off Neon provisioning. */
export async function createClientAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const raw = Object.fromEntries(formData);
  const parsed = createClientSchema.safeParse({ ...raw, provisionNow: raw.provisionNow === "on" });
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { provisionNow, ...rest } = parsed.data;

  if (await prisma.client.findUnique({ where: { slug: rest.slug } })) {
    return { ok: false, error: "Slug already in use", fieldErrors: { slug: ["Already taken"] } };
  }

  const data = clean(rest);
  const client = await prisma.client.create({
    data: {
      ...data,
      ownerEmail: rest.ownerEmail.toLowerCase(),
      country: data.country || "India",
    },
  });
  await logActivity("client.created", { clientId: client.id, adminId: session.sub, details: { cafeName: client.cafeName } });

  if (provisionNow) {
    // Fire-and-forget; the detail page polls /api/clients/[id]/status
    void provisionClient(client.id, { adminId: session.sub });
  }

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  const parsed = updateClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = clean(parsed.data);
  await prisma.client.update({ where: { id }, data });
  await logActivity("client.updated", { clientId: id, adminId: session.sub });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { ok: true, message: "Client updated" };
}

export async function setClientStatusAction(id: string, status: ClientStatus) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  await prisma.client.update({ where: { id }, data: { status } });
  await logActivity(`client.status.${status.toLowerCase()}`, { clientId: id, adminId: session.sub });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

/** (Re)run provisioning for an existing client. */
export async function provisionClientAction(id: string) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  void provisionClient(id, { adminId: session.sub });
  revalidatePath(`/clients/${id}`);
}

/** Link an already-existing database (e.g. QR-Order for Negi's Kitchen). */
export async function attachDatabaseAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  const dbName = String(formData.get("dbName") ?? "").trim();
  if (!dbName) return { ok: false, error: "Database name is required" };
  try {
    await attachExistingDatabase(id, dbName, { adminId: session.sub });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: `Linked database "${dbName}"` };
}

/** Set whether the platform takes a cut of this cafe's orders, and at what %. Super admin only. */
export async function updateCommissionAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireRole("SUPER_ADMIN");
  const parsed = commissionSchema.safeParse({
    commissionEnabled: formData.get("commissionEnabled") === "on",
    commissionPercent: formData.get("commissionPercent"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { commissionEnabled, commissionPercent } = parsed.data;
  await prisma.client.update({ where: { id }, data: { commissionEnabled, commissionPercent } });
  await logActivity(commissionEnabled ? "client.commission.enabled" : "client.commission.disabled", {
    clientId: id, adminId: session.sub, details: { commissionPercent },
  });
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Commission settings saved" };
}

/** Generate a new app password for the cafe owner. */
export async function resetOwnerPasswordAction(id: string) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN");
  await resetOwnerPassword(id, { adminId: session.sub });
  revalidatePath(`/clients/${id}`);
}

/** Drop the tenant's database (irreversible). */
export async function deprovisionClientAction(id: string) {
  const session = await requireRole("SUPER_ADMIN");
  await deprovisionClient(id, { adminId: session.sub });
  revalidatePath(`/clients/${id}`);
}

/** Delete the client record AND its Neon project. */
export async function deleteClientAction(id: string) {
  const session = await requireRole("SUPER_ADMIN");
  const client = await prisma.client.findUniqueOrThrow({ where: { id } });
  if (client.dbName) {
    const r = await deprovisionClient(id, { adminId: session.sub });
    if (!r.ok) throw new Error(`Could not drop database: ${r.error}`);
  }
  await prisma.client.delete({ where: { id } });
  await logActivity("client.deleted", { adminId: session.sub, details: { cafeName: client.cafeName, slug: client.slug } });
  revalidatePath("/clients");
  redirect("/clients");
}

