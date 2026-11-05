
const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"];

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

async function handleResponse<T>(response: Response): Promise<T> {
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Something went wrong.");
  }

  return result as T;
}

export async function issueCredential(
  payload: IssueCredentialPayload
): Promise<IssueCredentialResponse> {
  const response = await fetch(`${API_BASE_URL}/credentials/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<IssueCredentialResponse>(response);
}

export async function verifyCredential(
  tokenId: string
): Promise<VerifyCredentialResponse> {
  const response = await fetch(
    `${API_BASE_URL}/credentials/${encodeURIComponent(tokenId)}`
  );

  return handleResponse<VerifyCredentialResponse>(response);
}
