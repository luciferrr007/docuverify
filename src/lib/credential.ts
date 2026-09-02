/**
 * Credential integrity helpers — frontend only.
 * Workflow: Credential Details -> Canonical Data -> SHA-256 Hash -> Token ID
 */

/**
 * Build a consistent canonical representation of credential values.
 * Values are trimmed, uppercased and joined with "|" in the given order.
 * Example: DEG001|REG12345|JOHN DOE|B.TECH COMPUTER SCIENCE|2026|ABC UNIVERSITY
 */
export function createCanonicalData(orderedValues: (string | number | undefined)[]): string {
  return orderedValues
    .map((value) => String(value ?? "").trim().toUpperCase())
    .join("|");
}

/** Generate a real SHA-256 hash (hex) using the Web Crypto API. */
export async function generateSHA256(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a readable unique credential token id: DCR-YYYY-XXXXXXXX */
export function generateTokenId(): string {
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  const suffix = Array.from(random)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `DCR-${new Date().getFullYear()}-${suffix}`;
}
