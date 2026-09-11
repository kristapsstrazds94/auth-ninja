import { AuthNinjaError } from "@auth-ninja/core/errors";
import { parseAuthErrorResponse, type AuthClient } from "./auth-client.js";

export type AuthUser = {
  id: string;
  email: string;
  mfaEnabled?: boolean;
  passkeysEnabled?: boolean;
};

export type SessionResponse = {
  authenticated: true;
  user: AuthUser;
};

export type MfaRequiredResponse = {
  mfaRequired: true;
  loginToken: string;
};

export type LoginResult = SessionResponse | MfaRequiredResponse;

export type RegisterInput = {
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export function isSessionResponse(result: LoginResult): result is SessionResponse {
  return "authenticated" in result && result.authenticated === true;
}

export function isMfaRequiredResponse(result: LoginResult): result is MfaRequiredResponse {
  return "mfaRequired" in result && result.mfaRequired === true;
}

export async function fetchSession(client: AuthClient): Promise<SessionResponse | null> {
  try {
    return await client.requestJson<SessionResponse>("/auth/session");
  } catch (error) {
    if (error instanceof AuthNinjaError && error.code === "SESSION_EXPIRED") {
      return null;
    }
    throw error;
  }
}

export async function login(
  client: AuthClient,
  input: LoginInput,
): Promise<LoginResult> {
  return client.requestJson<LoginResult>("/auth/login", {
    method: "POST",
    json: input,
  });
}

export async function register(
  client: AuthClient,
  input: RegisterInput,
): Promise<SessionResponse> {
  return client.requestJson<SessionResponse>("/auth/register", {
    method: "POST",
    json: input,
  });
}

export async function logout(client: AuthClient): Promise<void> {
  const response = await client.request("/auth/logout", { method: "POST" });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseAuthErrorResponse(response.status, body);
  }

  client.clearCsrfToken();
}
