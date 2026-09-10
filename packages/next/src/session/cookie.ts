import type { AuthNinjaConfig } from "@auth-ninja/core";
import { AUTH_SESSION_COOKIE_NAME } from "./constants.js";

export type SessionCookieOptions = {
  /** Absolute session lifetime in seconds (from config.sessionAbsoluteHours). */
  maxAgeSeconds: number;
  secure: boolean;
};

export function sessionCookieOptionsFromConfig(config: AuthNinjaConfig): SessionCookieOptions {
  return {
    maxAgeSeconds: config.sessionAbsoluteHours * 60 * 60,
    secure: config.baseUrl.startsWith("https://"),
  };
}

/** Build Set-Cookie header for a new session. */
export function buildSessionSetCookieHeader(
  token: string,
  options: SessionCookieOptions,
): string {
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${options.maxAgeSeconds}`,
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/** Build Set-Cookie header that clears the session cookie. */
export function buildSessionClearCookieHeader(secure: boolean): string {
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/** Read the raw session token from a Cookie header value. */
export function parseSessionCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`)) {
      continue;
    }

    const value = trimmed.slice(AUTH_SESSION_COOKIE_NAME.length + 1);
    return value.length > 0 ? value : undefined;
  }

  return undefined;
}
