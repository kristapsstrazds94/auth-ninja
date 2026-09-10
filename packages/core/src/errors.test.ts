import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_CATALOG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_DEFAULT_STATUS,
  AUTH_ERROR_MESSAGES,
  AUTH_GENERIC_MESSAGES,
  AuthNinjaError,
  createAuthError,
  isAuthNinjaError,
  toAuthErrorResponse,
} from "./errors.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const openApiPath = join(packageRoot, "../protocol/openapi.json");

/** Phrases that must not appear in user-facing auth messages (enumeration / disclosure). */
const FORBIDDEN_MESSAGE_FRAGMENTS = [
  "already registered",
  "already exists",
  "does not exist",
  "not found",
  "unknown email",
  "email exists",
  "no account",
  "no user",
  "unregistered",
] as const;

describe("AUTH_ERROR_CODES", () => {
  it("matches OpenAPI ErrorCode enum", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as {
      components?: { schemas?: { ErrorCode?: { enum?: string[] } } };
    };
    const enumValues = doc.components?.schemas?.ErrorCode?.enum ?? [];

    expect([...AUTH_ERROR_CODES].sort()).toEqual([...enumValues].sort());
  });
});

describe("AUTH_ERROR_MESSAGES", () => {
  it("defines a generic message for every error code", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(AUTH_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("uses non-enumerating messages for auth-sensitive codes", () => {
    const sensitiveCodes = [
      "INVALID_CREDENTIALS",
      "ACCOUNT_LOCKED",
      "VALIDATION_ERROR",
    ] as const;

    for (const code of sensitiveCodes) {
      const message = AUTH_ERROR_MESSAGES[code].toLowerCase();
      for (const fragment of FORBIDDEN_MESSAGE_FRAGMENTS) {
        expect(message, `${code} contains "${fragment}"`).not.toContain(fragment);
      }
    }
  });

  it("matches OpenAPI response examples", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as {
      components?: {
        responses?: Record<
          string,
          { content?: { "application/json"?: { example?: { message?: string } } } }
        >;
      };
    };
    const responses = doc.components?.responses ?? {};

    const exampleMap: Record<string, string> = {
      InvalidCredentials: "INVALID_CREDENTIALS",
      AccountLocked: "ACCOUNT_LOCKED",
      SessionExpired: "SESSION_EXPIRED",
      MfaInvalid: "MFA_INVALID",
      CsrfInvalid: "CSRF_INVALID",
      RateLimited: "RATE_LIMITED",
      Forbidden: "FORBIDDEN",
      ValidationError: "VALIDATION_ERROR",
    };

    for (const [responseName, code] of Object.entries(exampleMap)) {
      const example = responses[responseName]?.content?.["application/json"]?.example;
      expect(example?.message).toBe(AUTH_ERROR_MESSAGES[code as keyof typeof AUTH_ERROR_MESSAGES]);
    }
  });
});

describe("AUTH_GENERIC_MESSAGES", () => {
  it("uses non-enumerating copy for register and password reset", () => {
    for (const message of Object.values(AUTH_GENERIC_MESSAGES)) {
      const lower = message.toLowerCase();
      for (const fragment of FORBIDDEN_MESSAGE_FRAGMENTS) {
        expect(lower).not.toContain(fragment);
      }
    }
  });

  it("matches OpenAPI flow examples", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as {
      paths?: Record<
        string,
        Record<
          string,
          {
            responses?: Record<
              string,
              { content?: { "application/json"?: { example?: { message?: string } } } }
            >;
          }
        >
      >;
    };

    const register409 =
      doc.paths?.["/auth/register"]?.post?.responses?.["409"]?.content?.[
        "application/json"
      ]?.example?.message;
    expect(register409).toBe(AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED);

    const resetRequest200 =
      doc.paths?.["/auth/password-reset/request"]?.post?.responses?.["200"]?.content?.[
        "application/json"
      ]?.example?.message;
    expect(resetRequest200).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_REQUESTED);

    const resetConfirm400 =
      doc.paths?.["/auth/password-reset/confirm"]?.post?.responses?.["400"]?.content?.[
        "application/json"
      ]?.example?.message;
    expect(resetConfirm400).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_FAILED);
  });
});

describe("AUTH_ERROR_CATALOG", () => {
  it("documents every error code with message and status", () => {
    const catalogCodes = AUTH_ERROR_CATALOG.map((entry) => entry.code).sort();
    expect(catalogCodes).toEqual([...AUTH_ERROR_CODES].sort());

    for (const entry of AUTH_ERROR_CATALOG) {
      expect(entry.message).toBe(AUTH_ERROR_MESSAGES[entry.code]);
      expect(entry.httpStatus).toBe(AUTH_ERROR_DEFAULT_STATUS[entry.code]);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe("AuthNinjaError helpers", () => {
  it("createAuthError uses default generic message and status", () => {
    const error = createAuthError("INVALID_CREDENTIALS");
    expect(error.message).toBe("Invalid email or password.");
    expect(error.status).toBe(401);
    expect(error.code).toBe("INVALID_CREDENTIALS");
  });

  it("createAuthError allows overrides", () => {
    const error = createAuthError("VALIDATION_ERROR", {
      message: "Custom validation message.",
      status: 422,
    });
    expect(error.message).toBe("Custom validation message.");
    expect(error.status).toBe(422);
  });

  it("toAuthErrorResponse serializes code and message", () => {
    const error = createAuthError("SESSION_EXPIRED");
    expect(toAuthErrorResponse(error)).toEqual({
      code: "SESSION_EXPIRED",
      message: "Session expired.",
    });
  });

  it("isAuthNinjaError narrows unknown values", () => {
    const error = new AuthNinjaError("FORBIDDEN", "Forbidden.");
    expect(isAuthNinjaError(error)).toBe(true);
    expect(isAuthNinjaError(new Error("other"))).toBe(false);
    expect(isAuthNinjaError(null)).toBe(false);
  });
});
