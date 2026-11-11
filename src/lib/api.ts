
const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"];

// ==========================================
// CREDENTIAL TYPES
// ==========================================

export interface IssueCredentialPayload {
  tokenId: string;
  documentType: string;
  documentTypeKey: "academic" | "license" | "government";
  data: Record<string, string>;
  fingerprint: string;
  issuedAt: string;
}

export interface IssueCredentialResponse {
  success: boolean;
  message: string;
  credential: {
    tokenId: string;
    documentType: string;
    documentTypeKey: string;
    data: Record<string, unknown>;
    fingerprint: string;
    issuedAt: string;
    status: string;
  };
}

export interface VerifyCredentialResponse {
  success: boolean;
  message: string;
  verification: {
    credentialExists: boolean;
    integrityValid: boolean;
    status: string;
    isValid: boolean;
  };
  credential: IssueCredentialResponse["credential"];
}

export type BlockchainStatus =
  | "not_registered"
  | "pending"
  | "confirmed"
  | "failed";

export interface InstitutionCredential {
  tokenId: string;
  documentType: string;
  documentTypeKey: "academic" | "license" | "government";
  issuedAt: string;
  createdAt: string;
  blockchainStatus: BlockchainStatus;
  status: "active" | "revoked";
  transactionHash: string | null;
  blockNumber: number | null;
}

export interface InstitutionCredentialSummary {
  total: number;
  confirmed: number;
  pending: number;
  failed: number;
  notRegistered: number;
}

export interface InstitutionCredentialsResponse {
  success: boolean;
  message: string;
  count: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: InstitutionCredentialSummary;
  credentials: InstitutionCredential[];
}

// ==========================================
// COMMON RESPONSE HANDLER
// ==========================================

async function handleResponse<T>(response: Response): Promise<T> {
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Something went wrong.");
  }

  return result as T;
}

// ==========================================
// CREDENTIAL ISSUANCE
// ==========================================

export async function issueCredential(
  payload: IssueCredentialPayload
): Promise<IssueCredentialResponse> {
  const token = sessionStorage.getItem("institutionToken");

  if (!token) {
    throw new Error("Please log in with an approved institution account.");
  }

  const response = await fetch(`${API_BASE_URL}/credentials/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<IssueCredentialResponse>(response);
}

// ==========================================
// INSTITUTION CREDENTIAL HISTORY
// ==========================================

export async function getInstitutionCredentials(
  page = 1,
  signal?: AbortSignal
): Promise<InstitutionCredentialsResponse> {
  const token = sessionStorage.getItem("institutionToken");

  if (!token) {
    throw new Error("Please log in to view your credentials.");
  }

  const response = await fetch(
    `${API_BASE_URL}/credentials/mine?page=${page}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: signal ?? null,
    }
  );

  return handleResponse<InstitutionCredentialsResponse>(response);
}

// ==========================================
// PUBLIC CREDENTIAL VERIFICATION
// NO LOGIN REQUIRED
// ==========================================

export async function verifyCredential(
  tokenId: string
): Promise<VerifyCredentialResponse> {
  const response = await fetch(
    `${API_BASE_URL}/credentials/${encodeURIComponent(tokenId)}`
  );

  return handleResponse<VerifyCredentialResponse>(response);
}

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

export interface AdminLoginResponse {
  success: boolean;
  message: string;
  token: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse<AdminLoginResponse>(response);
}

// ==========================================
// INSTITUTION TYPES
// ==========================================

export type InstitutionStatus = "pending" | "approved" | "rejected";

export interface Institution {
  _id: string;
  id?: string;
  institutionName: string;
  officialWebsite: string;
  officialEmail: string;
  registrationDetails: string;
  walletAddress: string;
  verificationDocuments: {
    documentName: string;
    documentUrl: string;
  }[];
  applicationStatus: InstitutionStatus;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

export interface InstitutionsResponse {
  success: boolean;
  count: number;
  institutions: Institution[];
}

// ==========================================
// INSTITUTION REGISTRATION
// ==========================================

export interface InstitutionRegistrationPayload {
  institutionName: string;
  officialWebsite: string;
  officialEmail: string;
  password: string;
  registrationDetails: string;
  walletAddress: string;
  verificationDocuments?: {
    documentName: string;
    documentUrl: string;
  }[];
}

export interface InstitutionRegistrationResponse {
  success: boolean;
  message: string;
  institution: {
    id: string;
    institutionName: string;
    officialEmail: string;
    walletAddress: string;
    applicationStatus: InstitutionStatus;
    createdAt: string;
  };
}

export async function registerInstitution(
  payload: InstitutionRegistrationPayload
): Promise<InstitutionRegistrationResponse> {
  const response = await fetch(`${API_BASE_URL}/institutions/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<InstitutionRegistrationResponse>(response);
}

// ==========================================
// INSTITUTION LOGIN
// ==========================================

export interface InstitutionLoginResponse {
  success: boolean;
  message: string;
  token: string;
  institution: {
    id: string;
    institutionName: string;
    officialEmail: string;
    walletAddress: string;
    applicationStatus: InstitutionStatus;
    rejectionReason?: string | null;
    approvedAt?: string | null;
  };
}

export async function institutionLogin(
  officialEmail: string,
  password: string
): Promise<InstitutionLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/institutions/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ officialEmail, password }),
  });

  const result = await handleResponse<InstitutionLoginResponse>(response);

  sessionStorage.setItem("institutionToken", result.token);

  sessionStorage.setItem(
    "institution",
    JSON.stringify(result.institution)
  );

  return result;
}

// ==========================================
// INSTITUTION LOGOUT
// ==========================================

export function institutionLogout(): void {
  sessionStorage.removeItem("institutionToken");
  sessionStorage.removeItem("institution");
}

// ==========================================
// ADMIN AUTHENTICATION HEADERS
// ==========================================

function getAdminHeaders() {
  const token = sessionStorage.getItem("adminToken");

  if (!token) {
    throw new Error("Admin session expired. Please log in again.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ==========================================
// ADMIN: FETCH PENDING INSTITUTIONS
// ==========================================

export async function getPendingInstitutions(): Promise<InstitutionsResponse> {
  const response = await fetch(`${API_BASE_URL}/institutions/pending`, {
    headers: getAdminHeaders(),
  });

  return handleResponse<InstitutionsResponse>(response);
}

// ==========================================
// ADMIN: FETCH INSTITUTIONS BY STATUS
// ==========================================

export async function getInstitutionsByStatus(
  status: InstitutionStatus
): Promise<InstitutionsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/institutions/status/${status}`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse<InstitutionsResponse>(response);
}

// ==========================================
// ADMIN: FETCH ONE INSTITUTION
// ==========================================

export async function getInstitution(
  id: string
): Promise<{ success: boolean; institution: Institution }> {
  const response = await fetch(
    `${API_BASE_URL}/institutions/${encodeURIComponent(id)}`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
}

// ==========================================
// ADMIN: APPROVE INSTITUTION
// ==========================================

export async function approveInstitution(
  id: string
): Promise<{ success: boolean; message: string; institution: Institution }> {
  const response = await fetch(
    `${API_BASE_URL}/institutions/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
}

// ==========================================
// ADMIN: REJECT INSTITUTION
// ==========================================

export async function rejectInstitution(
  id: string,
  rejectionReason: string
): Promise<{ success: boolean; message: string; institution: Institution }> {
  const response = await fetch(
    `${API_BASE_URL}/institutions/${encodeURIComponent(id)}/reject`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify({ rejectionReason }),
    }
  );

  return handleResponse(response);
}
