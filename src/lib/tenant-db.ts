/**
 * Connections to tenant (per-cafe) databases and the shared Neon project.
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

export function connect(connectionString: string): Sql {
  return neon(connectionString);
}

/** The Admin DB connection — also used to CREATE/DROP tenant databases. */
export function adminSql(): Sql {
  return neon(env.DATABASE_URL);
}

/** Build a connection string for another database on the same Neon endpoint. */
export function connectionStringFor(dbName: string): string {
  const u = new URL(env.DATABASE_URL);
  u.pathname = `/${dbName}`;
  return u.toString();
}

/** Database name of the Admin connection (e.g. "Admin"). */
export function adminDbName(): string {
  return new URL(env.DATABASE_URL).pathname.replace(/^\//, "");
}

/** Only allow safe identifiers for CREATE/DROP DATABASE. */
export function assertSafeDbName(name: string) {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
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

export async function listDatabases(): Promise<{ name: string; sizeBytes: number }[]> {
  const rows = await adminSql().query(
    `SELECT datname AS name, pg_database_size(datname)::bigint AS size
     FROM pg_database WHERE NOT datistemplate ORDER BY datname`,
  );
  return rows.map((r) => ({ name: r.name as string, sizeBytes: Number(r.size) }));
}
