/**
 * Environment access. Values are read lazily so a missing variable fails at
 * request time with a clear message instead of crashing `next build`
 * (Vercel's "Collecting page data" step imports server modules with no env).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  /** The one shared Postgres database every cafe's tenant data lives in (multi-tenant, scoped by cafe_id). */
  get SHARED_DB_URL() { return required("SHARED_DB_URL"); },
  get SESSION_SECRET() { return required("SESSION_SECRET"); },
  get ENCRYPTION_KEY() { return required("ENCRYPTION_KEY"); },
  get NEON_PROJECT_ID() { return process.env.NEON_PROJECT_ID ?? ""; },
  get CLIENT_APP_URL() { return process.env.CLIENT_APP_URL ?? "http://localhost:3001"; },
};
