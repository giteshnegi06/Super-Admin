/**
 * Provisioning pipeline — every cafe lives as rows in ONE shared database,
 * scoped by cafe_id (no more one Postgres database per cafe).
 *
 *   Client row → ensure shared schema exists → insert cafes/admin_users/tables rows
 *
 * Each step updates `provisionStatus` so the UI can poll progress.
 */
import type { ProvisionStatus } from "@prisma/client";
import { prisma } from "./db";
import { encrypt, decrypt } from "./crypto";
import { logActivity } from "./auth";
import { currencyByCode } from "./currencies";
import { hashPassword, generatePassword, verifyPassword } from "./tenant-auth";
import { TENANT_SCHEMA_SQL } from "./tenant-schema";
import { sharedSql, runSqlScript, type Sql } from "./tenant-db";

async function setStatus(clientId: string, provisionStatus: ProvisionStatus, extra: Record<string, unknown> = {}) {
  await prisma.client.update({ where: { id: clientId }, data: { provisionStatus, ...extra } });
}

type CafeRowClient = {
  cafeId: string; cafeName: string; tagline: string | null; address: string | null; ownerPhone: string | null; currency: string;
};

/** Push this client's editable cafe fields straight into its shared-DB `cafes` row — no re-provisioning needed. */
export async function syncCafeRow(client: CafeRowClient) {
  await sharedSql().query(
    `UPDATE cafes SET name = $2, tagline = $3, address = $4, phone = $5, currency = $6, updated_at = now() WHERE id = $1`,
    [client.cafeId, client.cafeName, client.tagline, client.address, client.ownerPhone, currencyByCode(client.currency).symbol],
  );
}

export async function provisionClient(clientId: string, opts: { adminId?: string } = {}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  try {
    // 1. Make sure the shared schema exists (idempotent — safe to re-run) ---
    await setStatus(clientId, "RUNNING_MIGRATIONS", { provisionError: null });
    const sql = sharedSql();
    await runSqlScript(sql, TENANT_SCHEMA_SQL);

    // 2. Seed this cafe's row, owner admin and starter tables --------------
    await setStatus(clientId, "SEEDING");
    const cafeId = client.cafeId ?? client.slug;
    await sql.query(
      `INSERT INTO cafes (id, name, tagline, address, phone, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tagline = EXCLUDED.tagline,
         address = EXCLUDED.address, phone = EXCLUDED.phone, currency = EXCLUDED.currency, updated_at = now()`,
      [cafeId, client.cafeName, client.tagline, client.address, client.ownerPhone, currencyByCode(client.currency).symbol],
    );
    // Owner's login for the QR-Ordering app (generated once, kept encrypted on the Client)
    await ensureOwnerLogin(sql, { ...client, cafeId });
    // Same naming convention as Negi's Kitchen: id/code "table-01", number "Table 01"
    for (let i = 1; i <= client.initialTables; i++) {
      const n = String(i).padStart(2, "0");
      await sql.query(
        `INSERT INTO tables (id, cafe_id, number, code, capacity, status)
         VALUES ($1, $2, $3, $1, 4, 'available') ON CONFLICT (id) DO NOTHING`,
        [`table-${n}`, cafeId, `Table ${n}`],
      );
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { cafeId, provisionStatus: "READY", provisionedAt: new Date(), provisionError: null },
    });
    await logActivity("client.provisioned", { clientId, adminId: opts.adminId, details: { cafeId } });
    return { ok: true as const, cafeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(clientId, "FAILED", { provisionError: message });
    await logActivity("client.provision_failed", { clientId, adminId: opts.adminId, details: { message } });
    return { ok: false as const, error: message };
  }
}

/** Remove this cafe's rows from the shared database (cascades through every child table). */
export async function deprovisionClient(clientId: string, opts: { adminId?: string } = {}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.cafeId) return { ok: true as const };
  await setStatus(clientId, "DELETING");
  try {
    await sharedSql().query(`DELETE FROM cafes WHERE id = $1`, [client.cafeId]);
    await prisma.client.update({
      where: { id: clientId },
      data: { provisionStatus: "PENDING", provisionedAt: null },
    });
    await logActivity("client.deprovisioned", { clientId, adminId: opts.adminId, details: { cafeId: client.cafeId } });
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(clientId, "FAILED", { provisionError: message });
    return { ok: false as const, error: message };
  }
}

type OwnerLoginClient = {
  id: string; cafeId: string | null; ownerName: string; ownerEmail: string; ownerPasswordEncrypted: string | null;
};

/**
 * Make sure the owner has a working admin login for this cafe (cafe_id-scoped)
 * in the shared database. The password is generated once and kept (encrypted)
 * on the Client so it can be shown / copied from the admin; pass `reset: true`
 * to rotate it.
 */
export async function ensureOwnerLogin(sql: Sql, client: OwnerLoginClient, opts: { reset?: boolean } = {}) {
  if (!client.cafeId) throw new Error("Client has no cafe id");
  const email = client.ownerEmail.toLowerCase();
  const needsPassword = opts.reset || !client.ownerPasswordEncrypted;
  const password = needsPassword ? generatePassword() : decrypt(client.ownerPasswordEncrypted!);
  const hash = hashPassword(password);

  // The deterministic id `admin-${cafeId}` can already be taken by an
  // unrelated real account under a different email — e.g. a cafe migrated
  // from a standalone system that already had its own admin login before
  // Super-Admin ever managed it. Reuse this owner's existing row (by email)
  // if there is one; otherwise pick an id that isn't already someone else's,
  // so this never overwrites a distinct, real staff account.
  const defaultId = `admin-${client.cafeId}`;
  const [ownRow] = await sql.query(`SELECT id FROM admin_users WHERE cafe_id = $1 AND email = $2`, [client.cafeId, email]);
  let id: string = ownRow?.id ?? defaultId;
  if (!ownRow) {
    const [taken] = await sql.query(`SELECT 1 FROM admin_users WHERE cafe_id = $1 AND id = $2`, [client.cafeId, defaultId]);
    if (taken) id = `owner-${client.cafeId}`;
  }

  await sql.query(
    `INSERT INTO admin_users (id, cafe_id, name, email, role, password_hash)
     VALUES ($1, $2, $3, $4, 'admin', $5)
     ON CONFLICT (cafe_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       role = 'admin',
       -- keep the password the owner already has unless we are (re)setting it
       password_hash = CASE WHEN $6::boolean OR admin_users.password_hash IS NULL
                            THEN EXCLUDED.password_hash ELSE admin_users.password_hash END`,
    [id, client.cafeId, client.ownerName, email, hash, needsPassword],
  );
  if (needsPassword) {
    await prisma.client.update({
      where: { id: client.id },
      data: { ownerPasswordEncrypted: encrypt(password), ownerPasswordSetAt: new Date() },
    });
  }
  return { email, password };
}

/** Rotate the cafe owner's app password. */
export async function resetOwnerPassword(clientId: string, opts: { adminId?: string } = {}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.cafeId) throw new Error("Cafe is not provisioned yet");
  const creds = await ensureOwnerLogin(sharedSql(), client, { reset: true });
  await logActivity("client.owner_password_reset", { clientId, adminId: opts.adminId });
  return creds;
}

export type OwnerLoginStatus =
  | { state: "missing" }                          // no admin_users row / no hash for this cafe
  | { state: "ok"; password: string }             // admin's stored password matches the shared DB
  | { state: "changed_in_app"; hasStored: boolean }; // owner changed it from their console

/**
 * Compare the password the admin holds with the live hash in the shared DB.
 * Read on every render so a password changed from the cafe console is
 * reported instead of silently showing a stale value.
 */
export async function ownerLoginStatus(client: {
  cafeId: string | null; ownerEmail: string; ownerPasswordEncrypted: string | null;
}): Promise<OwnerLoginStatus> {
  if (!client.cafeId) return { state: "missing" };
  const [row] = await sharedSql().query(
    `SELECT password_hash FROM admin_users WHERE cafe_id = $1 AND email = $2`,
    [client.cafeId, client.ownerEmail.toLowerCase()],
  );
  if (!row?.password_hash) return { state: "missing" };
  if (!client.ownerPasswordEncrypted) return { state: "changed_in_app", hasStored: false };
  const password = decrypt(client.ownerPasswordEncrypted);
  return verifyPassword(password, row.password_hash) ? { state: "ok", password } : { state: "changed_in_app", hasStored: true };
}
