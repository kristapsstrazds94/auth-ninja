import { parseAuthErrorResponse, type AuthClient } from "./auth-client.js";
import type { SessionResponse } from "./auth-session.js";

export type TotpEnrollResponse = {
  secret: string;
  otpauthUrl: string;
};

export type TotpConfirmResponse = {
  mfaEnabled: true;
  backupCodes: string[];
};

export type BackupCodesResponse = {
  backupCodes: string[];
};

export type TotpVerifyInput = {
  loginToken: string;
  code: string;
};

export type Disable2faInput = {
  password: string;
  code?: string;
  backupCode?: string;
};

export async function enroll2fa(client: AuthClient): Promise<TotpEnrollResponse> {
  return client.requestJson<TotpEnrollResponse>("/auth/2fa/enroll", {
    method: "POST",
  });
}

export async function confirm2fa(
  client: AuthClient,
  code: string,
): Promise<TotpConfirmResponse> {
  return client.requestJson<TotpConfirmResponse>("/auth/2fa/confirm", {
    method: "POST",
    json: { code },
  });
}

export async function verify2faLogin(
  client: AuthClient,
  input: TotpVerifyInput,
): Promise<SessionResponse> {
  return client.requestJson<SessionResponse>("/auth/2fa/verify", {
    method: "POST",
    json: input,
  });
}

export async function regenerateBackupCodes(
  client: AuthClient,
  password: string,
): Promise<BackupCodesResponse> {
  return client.requestJson<BackupCodesResponse>("/auth/2fa/backup-codes", {
    method: "POST",
    json: { password },
  });
}

export async function disable2fa(
  client: AuthClient,
  input: Disable2faInput,
): Promise<void> {
  const response = await client.request("/auth/2fa", {
    method: "DELETE",
    json: input,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseAuthErrorResponse(response.status, body);
  }
}
