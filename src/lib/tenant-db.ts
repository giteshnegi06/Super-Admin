/**
 * Connection to the one shared tenant database (every cafe's data, scoped by
 * cafe_id) and to the Super-Admin control-plane database.
 *
 * Uses @neondatabase/serverless over HTTP — same driver the QR-Ordering app
 * uses — because plain TCP `pg` connections stall on some Windows networks
 * (IPv6 routes advertised but unreachable). Works identically on Vercel.
 */
import dns from "dns";
import { Agent, setGlobalDispatcher } from "undici";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";

if (process.env.VERCEL !== "1") {
  dns.setDefaultResultOrder("ipv4first");
  setGlobalDispatcher(new Agent({ connect: { autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 300 } }));
}

export type Sql = NeonQueryFunction<false, false>;

/** The one shared database every cafe's tenant data lives in. */
export function sharedSql(): Sql {
  return neon(env.SHARED_DB_URL);
}

/** The Super-Admin control-plane database (Client/AdminUser/ActivityLog, managed by Prisma). */
export function adminSql(): Sql {
  return neon(env.DATABASE_URL);
}

/**
 * Run a multi-statement SQL file over the HTTP driver (which accepts one
 * statement per request). Splits on ';' at end of line; strips -- comments.
 */
export async function runSqlScript(sql: Sql, script: string) {
  const statements = script
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await sql.query(stmt);
  return statements.length;
}
