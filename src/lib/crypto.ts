/**
 * AES-256-GCM encryption for the cafe owner's app password, kept on the
 * Client row so a super admin can reveal/re-share it.
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "./env";

let _key: Buffer | null = null;
function key(): Buffer {
  if (!_key) {
    _key = Buffer.from(env.ENCRYPTION_KEY, "hex");
    if (_key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return _key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(":");
}

export function decrypt(payload: string): string {
  const [ivB, tagB, encB] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64")), decipher.final()]).toString("utf8");
}
