/**
 * Frontend-only credential registry backed by localStorage.
 * Credentials are keyed by their Token ID to avoid duplicates.
 */

const STORAGE_KEY = "docuverify_credentials";

export interface StoredCredential {
  tokenId: string;
  documentType: string;
  studentName: string;
  registrationNumber: string;
  degreeId: string;
  degree: string;
  year: string;
  issuer: string;
  fingerprint: string;
  issuedAt: string;
  status: "active" | "revoked";
}

function readCredentials(): StoredCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredCredential[];
  } catch {
    return [];
  }
}

function writeCredentials(credentials: StoredCredential[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

export function getCredentials(): StoredCredential[] {
  return readCredentials();
}

export function getCredentialByTokenId(tokenId: string): StoredCredential | null {
  return readCredentials().find((credential) => credential.tokenId === tokenId) ?? null;
}

export function credentialExists(tokenId: string): boolean {
  return readCredentials().some((credential) => credential.tokenId === tokenId);
}

/**
 * Persist a credential. Returns true if saved, false if a credential
 * with the same Token ID already exists or storage is unavailable.
 */
export function saveCredential(credential: StoredCredential): boolean {
  const credentials = readCredentials();
  if (credentials.some((existing) => existing.tokenId === credential.tokenId)) {
    return false;
  }
  credentials.push(credential);
  return writeCredentials(credentials);
}
