import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  AUTH_ENDPOINTS,
  AUTH_ERROR_CODES,
  CSRF_PROTECTED_METHODS,
} from "./index.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const openApiPath = join(packageRoot, "openapi.json");

type OpenApiDocument = {
  openapi?: string;
  paths: Record<string, Record<string, { operationId?: string; security?: unknown[] }>>;
  components?: {
    schemas?: {
      ErrorCode?: { enum?: string[] };
    };
    securitySchemes?: Record<string, { in?: string; name?: string }>;
  };
};

function parseEndpoint(endpoint: string): { method: string; path: string } {
  const space = endpoint.indexOf(" ");
  return {
    method: endpoint.slice(0, space).toLowerCase(),
    path: endpoint.slice(space + 1),
  };
}

describe("openapi.json contract", () => {
  it("is valid OpenAPI 3.1", async () => {
    const api = (await SwaggerParser.validate(openApiPath)) as OpenApiDocument;
    expect(api.openapi).toMatch(/^3\.1\./);
  });

  it("defines every canonical AUTH_ENDPOINT", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;

    for (const endpoint of AUTH_ENDPOINTS) {
      const { method, path } = parseEndpoint(endpoint);
      expect(doc.paths[path]?.[method], `missing ${endpoint}`).toBeDefined();
    }
  });

  it("documents all AUTH_ERROR_CODES in ErrorCode schema", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;
    const enumValues = doc.components?.schemas?.ErrorCode?.enum ?? [];

    for (const code of AUTH_ERROR_CODES) {
      expect(enumValues).toContain(code);
    }
  });

  it("requires CSRF header security on state-changing routes", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;

    for (const endpoint of CSRF_PROTECTED_METHODS) {
      const { method, path } = parseEndpoint(endpoint);
      const operation = doc.paths[path]?.[method];
      expect(operation, `missing operation ${endpoint}`).toBeDefined();

      const security = operation?.security ?? [];
      const requiresCsrf = security.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "csrfHeader" in entry,
      );
      expect(requiresCsrf, `${endpoint} must require csrfHeader`).toBe(true);
    }
  });

  it("defines HttpOnly session cookie security scheme", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;
    const session = doc.components?.securitySchemes?.sessionCookie;

    expect(session?.in).toBe("cookie");
    expect(session?.name).toBe("auth_session");
  });

  it("covers full auth cycle flows from threat model", () => {
    const doc = JSON.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;
    const pathKeys = Object.keys(doc.paths);

    const requiredPaths = [
      "/auth/register",
      "/auth/login",
      "/auth/logout",
      "/auth/session",
      "/auth/password-reset/request",
      "/auth/password-reset/confirm",
      "/auth/2fa/enroll",
      "/auth/2fa/verify",
      "/auth/passkeys/register/begin",
      "/auth/passkeys/login/finish",
      "/auth/csrf",
    ];

    for (const path of requiredPaths) {
      expect(pathKeys).toContain(path);
    }
  });
});
