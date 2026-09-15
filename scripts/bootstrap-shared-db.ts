/**
 * One-time bootstrap: create the shared multi-tenant database (if it doesn't
 * already exist) on the same Neon endpoint as the Admin DB, and apply the
 * shared schema to it. Prints the connection string to put in SHARED_DB_URL.
 */
import "dotenv/config";
import { adminSql, runSqlScript } from "../src/lib/tenant-db";
import { neon } from "@neondatabase/serverless";
import { TENANT_SCHEMA_SQL } from "../src/lib/tenant-schema";
import { env } from "../src/lib/env";

const DB_NAME = process.argv[2] || "CafesShared";

async function main() {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(DB_NAME)) throw new Error(`Unsafe database name: ${DB_NAME}`);
  const admin = adminSql();
  const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
  if (exists.length === 0) {
    console.log(`Creating database "${DB_NAME}"...`);
    await admin.query(`CREATE DATABASE "${DB_NAME}" TEMPLATE template0`);
  } else {
    console.log(`Database "${DB_NAME}" already exists, reusing it.`);
  }

  const u = new URL(env.DATABASE_URL);
  u.pathname = `/${DB_NAME}`;
  const sharedUrl = u.toString();

  console.log("Applying shared schema...");
  const shared = neon(sharedUrl);
  const n = await runSqlScript(shared, TENANT_SCHEMA_SQL);
  console.log(`Applied ${n} statement(s).`);

  console.log("\nSHARED_DB_URL=" + sharedUrl);
}
main().catch((e) => { console.error(e); process.exit(1); });
