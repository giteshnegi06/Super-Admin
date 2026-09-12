/**
 * Provisioning pipeline — mirrors how "Negi's Kitchen" (database `QR-Order`)
 * is set up: one Postgres database per cafe inside the shared Neon project.
 *
 *   Client row → CREATE DATABASE → apply tenant-schema.sql → seed cafes/tables
 *
 * Each step updates `provisionStatus` so the UI can poll progress.
 */
import type { ProvisionStatus } from "@prisma/client";
import { prisma } from "./db";
import { encrypt, decrypt } from "./crypto";
import { logActivity } from "./auth";
import { currencyByCode } from "./currencies";
import { hashPassword, generatePassword } from "./tenant-auth";
import { TENANT_SCHEMA_SQL } from "./tenant-schema";
import { adminSql, adminDbName, assertSafeDbName, connect, connectionStringFor, runSqlScript, type Sql } from "./tenant-db";


async function setStatus(clientId: string, provisionStatus: ProvisionStatus, extra: Record<string, unknown> = {}) {
  await prisma.client.update({ where: { id: clientId }, data: { provisionStatus, ...extra } });
}

/** Database name for a cafe, e.g. slug "blue-tokai" → "cafe_blue_tokai". */
export function dbNameForSlug(slug: string) {
  return `cafe_${slug.replace(/-/g, "_")}`;
}

export async function provisionClient(clientId: string, opts: { adminId?: string } = {}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  try {
    // 1. Create the database (skip if this client already has one) ---------
    let dbName = client.dbName;
    let connectionUri: string;
    if (dbName && client.dbConnectionEncrypted) {
      connectionUri = decrypt(client.dbConnectionEncrypted);
    } else {
      dbName = dbNameForSlug(client.slug);
      assertSafeDbName(dbName);
      await setStatus(clientId, "CREATING_DATABASE", { provisionError: null });

      const admin = adminSql();
      const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (exists.length === 0) await admin.query(`CREATE DATABASE "${dbName}"`);

      connectionUri = connectionStringFor(dbName);
      const u = new URL(connectionUri);
      await prisma.client.update({
        where: { id: clientId },
        data: {
          dbName,
          dbConnectionEncrypted: encrypt(connectionUri),
          neonEndpointHost: u.hostname,
          dbRoleName: u.username,
          neonProjectId: process.env.NEON_PROJECT_ID ?? null,
        },
      });
    }

    // 2. Apply the product schema -----------------------------------------
    await setStatus(clientId, "RUNNING_MIGRATIONS");
    const sql = connect(connectionUri);
    await runSqlScript(sql, TENANT_SCHEMA_SQL);

    // 3. Seed the single cafe row, owner admin and starter tables ------------
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
    await logActivity("client.provisioned", { clientId, adminId: opts.adminId, details: { dbName } });
    return { ok: true as const, dbName };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(clientId, "FAILED", { provisionError: message });
    await logActivity("client.provision_failed", { clientId, adminId: opts.adminId, details: { message } });
    return { ok: false as const, error: message };
  }
}

/** Permanently DROP the cafe's database. */
export async function deprovisionClient(clientId: string, opts: { adminId?: string } = {}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.dbName) return { ok: true as const };
  if (client.dbName === adminDbName()) throw new Error("Refusing to drop the Admin database");
  assertSafeDbName(client.dbName);
  await setStatus(clientId, "DELETING");
  try {
    await adminSql().query(`DROP DATABASE IF EXISTS "${client.dbName}" WITH (FORCE)`);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        provisionStatus: "PENDING",
        dbName: null, dbConnectionEncrypted: null, neonEndpointHost: null, dbRoleName: null, provisionedAt: null,
      },
    });
    await logActivity("client.deprovisioned", { clientId, adminId: opts.adminId, details: { dbName: client.dbName } });
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(clientId, "FAILED", { provisionError: message });
    return { ok: false as const, error: message };
  }
}

/**
 * Register an already-existing cafe database (e.g. the original `QR-Order`
 * database for Negi's Kitchen) as a client without creating anything.
 */
export async function attachExistingDatabase(clientId: string, dbName: string, opts: { adminId?: string } = {}) {
  assertSafeDbName(dbName);
  const connectionUri = connectionStringFor(dbName);
  const sql = connect(connectionUri);
  const cafes = await sql.query(`SELECT id, name FROM cafes LIMIT 1`);
  if (cafes.length === 0) throw new Error(`Database "${dbName}" has no cafes row`);
  const u = new URL(connectionUri);
  await prisma.client.update({
    where: { id: clientId },
    data: {
      dbName,
      cafeId: cafes[0].id as string,
      dbConnectionEncrypted: encrypt(connectionUri),
      neonEndpointHost: u.hostname,
      dbRoleName: u.username,
      neonProjectId: process.env.NEON_PROJECT_ID ?? null,
      provisionStatus: "READY",
      provisionedAt: new Date(),
      provisionError: null,
    },
  });
  await logActivity("client.attached_existing_db", { clientId, adminId: opts.adminId, details: { dbName } });
  // Existing databases (e.g. QR-Order) predate real logins — give the owner one now.
  const fresh = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  await ensureOwnerLogin(sql, fresh);
}

type OwnerLoginClient = {
  id: string; cafeId: string | null; ownerName: string; ownerEmail: string; ownerPasswordEncrypted: string | null;
};

/**
 * Make sure the owner has a working admin login in the cafe database.
 * The password is generated once and kept (encrypted) on the Client so it can
 * be shown / copied from the admin; pass `reset: true` to rotate it.
 */
export async function ensureOwnerLogin(sql: Sql, client: OwnerLoginClient, opts: { reset?: boolean } = {}) {
  if (!client.cafeId) throw new Error("Client has no cafe id");
  const email = client.ownerEmail.toLowerCase();
  const needsPassword = opts.reset || !client.ownerPasswordEncrypted;
  const password = needsPassword ? generatePassword() : decrypt(client.ownerPasswordEncrypted!);
  const hash = hashPassword(password);

  await sql.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash text`);
  await sql.query(
    `INSERT INTO admin_users (id, cafe_id, name, email, role, password_hash)
     VALUES ($1, $2, $3, $4, 'admin', $5)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = 'admin',
       -- keep the password the owner already has unless we are (re)setting it
       password_hash = CASE WHEN $6::boolean OR admin_users.password_hash IS NULL
                            THEN EXCLUDED.password_hash ELSE admin_users.password_hash END`,
    [`admin-${client.cafeId}`, client.cafeId, client.ownerName, email, hash, needsPassword],
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
  if (!client.dbConnectionEncrypted || !client.cafeId) throw new Error("Cafe database is not provisioned yet");
  const sql = connect(decrypt(client.dbConnectionEncrypted));
  const creds = await ensureOwnerLogin(sql, client, { reset: true });
  await logActivity("client.owner_password_reset", { clientId, adminId: opts.adminId });
  return creds;
}
