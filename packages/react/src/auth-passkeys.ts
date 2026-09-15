import { parseAuthErrorResponse, type AuthClient } from "./auth-client.js";
import type { SessionResponse } from "./auth-session.js";

/** WebAuthn options JSON from the server (creation or request). */
export type WebAuthnOptionsJson = Record<string, unknown>;

export type WebAuthnOptionsResponse = {
  options: WebAuthnOptionsJson;
};

/** Credential response JSON from the browser WebAuthn API. */
export type WebAuthnCredentialResponseJson = Record<string, unknown>;

export type PasskeyLoginBeginInput = {
  email?: string;
};

export type PasskeyCredential = {
  credentialId: string;
  createdAt: string;
  nickname?: string;
};

export type PasskeyListResponse = {
  passkeys: PasskeyCredential[];
};

export async function passkeyRegisterBegin(
  client: AuthClient,
): Promise<WebAuthnOptionsResponse> {
  return client.requestJson<WebAuthnOptionsResponse>("/auth/passkeys/register/begin", {
    method: "POST",
  });
}

export async function passkeyRegisterFinish(
  client: AuthClient,
  response: WebAuthnCredentialResponseJson,
): Promise<PasskeyCredential> {
  return client.requestJson<PasskeyCredential>("/auth/passkeys/register/finish", {
    method: "POST",
    json: { response },
  });
}

export async function passkeyLoginBegin(
  client: AuthClient,
  input: PasskeyLoginBeginInput = {},
): Promise<WebAuthnOptionsResponse> {
  return client.requestJson<WebAuthnOptionsResponse>("/auth/passkeys/login/begin", {
    method: "POST",
    json: input.email ? { email: input.email } : {},
  });
}

export async function passkeyLoginFinish(
  client: AuthClient,
  response: WebAuthnCredentialResponseJson,
): Promise<SessionResponse> {
  return client.requestJson<SessionResponse>("/auth/passkeys/login/finish", {
    method: "POST",
    json: { response },
  });
}

export async function listPasskeys(client: AuthClient): Promise<PasskeyListResponse> {
  return client.requestJson<PasskeyListResponse>("/auth/passkeys");
}

export async function deletePasskey(
  client: AuthClient,
  credentialId: string,
): Promise<void> {
  const response = await client.request(
    `/auth/passkeys/${encodeURIComponent(credentialId)}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseAuthErrorResponse(response.status, body);
  }
}
