import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const randomToken = (bytes = 32): string =>
  Buffer.from(crypto.randomBytes(bytes)).toString("base64url");
export const sha256Hex = (value: string): string =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");
export const pkceChallenge = (verifier: string): string =>
  crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");

export function timingSafeEqualText(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** AES-256-GCM; output = iv(12) | tag(16) | ciphertext. `aad` binds the value to its row. */
export function encrypt(key: Buffer, plaintext: string, aad: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(
  key: Buffer,
  blob: Uint8Array,
  aad: string,
): string | null {
  try {
    const buf = Buffer.from(blob);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      buf.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([
      decipher.update(buf.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
