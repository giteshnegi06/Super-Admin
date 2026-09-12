/**
 * AES-256-GCM encryption for tenant connection strings stored in the admin DB.
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "./env";

const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
if (KEY.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(":");
}

export function decrypt(payload: string): string {
  const [ivB, tagB, encB] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}

/** Hide the password in a connection string for display. */
export function maskConnectionString(uri: string): string {
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:********@");
}
