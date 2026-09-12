function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  SESSION_SECRET: required("SESSION_SECRET"),
  ENCRYPTION_KEY: required("ENCRYPTION_KEY"),
  NEON_PROJECT_ID: process.env.NEON_PROJECT_ID ?? "",
  CLIENT_APP_URL: process.env.CLIENT_APP_URL ?? "http://localhost:3001",
};
