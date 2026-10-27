import { createHash, randomBytes } from "node:crypto";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateReference(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]);
  return `RL-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

export function isPlausibleToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}
