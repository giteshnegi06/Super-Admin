import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { env } from "./env";
import type { AdminRole, Prisma } from "@prisma/client";

export const SESSION_COOKIE = "sa_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export type Session = { sub: string; email: string; name: string; role: AdminRole };

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: Session) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const s = payload as unknown as Session;
    // A deleted/deactivated admin must lose access immediately, not when the JWT expires.
    const user = await prisma.adminUser.findUnique({ where: { id: s.sub }, select: { isActive: true, role: true, name: true, email: true } });
    if (!user || !user.isActive) return null;
    return { sub: s.sub, email: user.email, name: user.name, role: user.role };
  } catch {
    return null;
  }
}

/** Use in server actions / route handlers; throws if unauthenticated. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

export async function requireRole(...roles: AdminRole[]): Promise<Session> {
  const s = await requireSession();
  if (!roles.includes(s.role)) throw new Error("Forbidden");
  return s;
}

export async function logActivity(
  action: string,
  opts: { clientId?: string; adminId?: string; details?: Record<string, unknown> } = {},
) {
  await prisma.activityLog.create({
    data: { action, clientId: opts.clientId, adminId: opts.adminId, details: (opts.details ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}
