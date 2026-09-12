import type { Client, ProvisionStatus, ClientStatus } from "@prisma/client";

export type ClientRow = Client;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Active", SUSPENDED: "Suspended",
};

export const PROVISION_STATUS_LABEL: Record<ProvisionStatus, string> = {
  PENDING: "Not provisioned",
  CREATING_DATABASE: "Creating database...",
  RUNNING_MIGRATIONS: "Running schema...",
  SEEDING: "Seeding data...",
  READY: "Ready",
  FAILED: "Failed",
  DELETING: "Deleting...",
};
