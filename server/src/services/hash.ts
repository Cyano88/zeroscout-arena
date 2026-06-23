import { createHash } from "node:crypto";

export function sha256Hex(value: unknown): string {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  return `0x${createHash("sha256").update(payload).digest("hex")}`;
}
