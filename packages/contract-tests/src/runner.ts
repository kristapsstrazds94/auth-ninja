import type {
  ContractDispatchFn,
  ContractExpect,
  ContractRunnerOptions,
  ContractScenario,
  ContractStep,
} from "./types.js";

type CaptureStore = Record<string, string>;

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveString(
  value: string,
  variables: Record<string, string>,
  captures: CaptureStore,
  generateTotp?: (secret: string) => string,
): string {
  const totpMatch = value.match(/^\{\{totp:([^}]+)\}\}$/);
  if (totpMatch) {
    const secret = captures[totpMatch[1]!];
    if (!secret || !generateTotp) {
      throw new Error(`Missing TOTP secret capture "${totpMatch[1]!}"`);
    }
    return generateTotp(secret);
  }

  if (value.startsWith("$")) {
    const key = value.slice(1);
    if (captures[key] !== undefined) {
      return captures[key]!;
    }
    if (variables[key] !== undefined) {
      return variables[key]!;
    }
    throw new Error(`Unknown variable or capture: ${value}`);
  }

  return value;
}

function resolveValue(
  value: unknown,
  variables: Record<string, string>,
  captures: CaptureStore,
  generateTotp?: (secret: string) => string,
): unknown {
  if (typeof value === "string") {
    return resolveString(value, variables, captures, generateTotp);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, variables, captures, generateTotp));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = resolveValue(nested, variables, captures, generateTotp);
    }
    return result;
  }
  return value;
}

function extractSessionCookie(
  response: Response,
  sessionCookieName: string,
): string | undefined {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return undefined;
  }
  const match = setCookie.match(new RegExp(`${sessionCookieName}=([^;]+)`));
  const token = match?.[1];
  return token && token.length > 0 ? token : undefined;
}

function captureFromResponse(
  response: Response,
  body: unknown,
  captureRules: Record<string, string>,
  sessionCookieName: string,
): CaptureStore {
  const captured: CaptureStore = {};
  for (const [name, source] of Object.entries(captureRules)) {
    if (source === "cookie") {
      const token = extractSessionCookie(response, sessionCookieName);
      if (!token) {
        throw new Error(`Expected session cookie capture "${name}" but none was set`);
      }
      captured[name] = token;
      continue;
    }
    if (source.startsWith("body.")) {
      const path = source.slice("body.".length);
      const value = getNestedValue(body, path);
      if (value === undefined || value === null) {
        throw new Error(`Expected capture "${name}" at ${source} but value was missing`);
      }
      captured[name] = String(value);
      continue;
    }
    throw new Error(`Unknown capture source: ${source}`);
  }
  return captured;
}

function assertPartialBody(
  actual: unknown,
  expected: Record<string, unknown>,
  variables: Record<string, string>,
  captures: CaptureStore,
  generateTotp?: (secret: string) => string,
): void {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = getNestedValue(actual, key);
    const resolvedExpected = resolveValue(expectedValue, variables, captures, generateTotp);
    if (JSON.stringify(actualValue) !== JSON.stringify(resolvedExpected)) {
      throw new Error(
        `Body mismatch at "${key}": expected ${JSON.stringify(resolvedExpected)}, got ${JSON.stringify(actualValue)}`,
      );
    }
  }
}

function assertExpect(
  response: Response,
  body: unknown,
  expect: ContractExpect,
  variables: Record<string, string>,
  captures: CaptureStore,
  generateTotp?: (secret: string) => string,
): void {
  if (response.status !== expect.status) {
    throw new Error(
      `Expected status ${expect.status}, got ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  if (expect.code !== undefined) {
    const code = getNestedValue(body, "code");
    if (code !== expect.code) {
      throw new Error(`Expected error code ${expect.code}, got ${String(code)}`);
    }
  }

  if (expect.body) {
    assertPartialBody(body, expect.body, variables, captures, generateTotp);
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function needsCsrf(step: ContractStep): boolean {
  if (step.skipCsrf) {
    return false;
  }
  if (step.csrf !== undefined) {
    return step.csrf;
  }
  return step.method === "POST" || step.method === "DELETE";
}

export async function runContractScenario(
  scenario: ContractScenario,
  dispatch: ContractDispatchFn,
  options: ContractRunnerOptions,
): Promise<void> {
  const variables = { ...scenario.variables };
  const captures: CaptureStore = {};
  let csrfToken: string | undefined;

  for (const step of scenario.steps) {
    const headers: Record<string, string> = {};

    if (step.session) {
      const sessionKey = typeof step.session === "string" ? step.session : "session";
      const token = captures[sessionKey];
      if (!token) {
        throw new Error(`Step "${step.name}" requires session capture "${sessionKey}"`);
      }
      headers.cookie = `${options.sessionCookieName}=${token}`;
    }

    if (needsCsrf(step)) {
      if (!csrfToken) {
        const csrfResponse = await dispatch("GET", "/auth/csrf");
        const csrfBody = (await readJsonBody(csrfResponse)) as { token?: string };
        if (!csrfBody.token) {
          throw new Error("Failed to fetch CSRF token");
        }
        csrfToken = csrfBody.token;
      }
      headers[options.csrfHeaderName] = csrfToken;
    }

    const body = step.body
      ? resolveValue(step.body, variables, captures, options.generateTotp)
      : undefined;

    const init: { headers: Record<string, string>; body?: unknown } = { headers };
    if (body !== undefined && step.method !== "GET") {
      init.headers["content-type"] = "application/json";
      init.body = body;
    }

    const response = await dispatch(step.method, step.path, init);
    const responseBody = await readJsonBody(response);

    assertExpect(
      response,
      responseBody,
      step.expect,
      variables,
      captures,
      options.generateTotp,
    );

    if (step.expect.capture) {
      Object.assign(
        captures,
        captureFromResponse(
          response,
          responseBody,
          step.expect.capture,
          options.sessionCookieName,
        ),
      );
    }
  }
}

export function loadScenarios(modules: ContractScenario[]): ContractScenario[] {
  for (const scenario of modules) {
    if (!scenario.id || !scenario.steps?.length) {
      throw new Error(`Invalid contract scenario: ${scenario.id ?? "unknown"}`);
    }
  }
  return modules;
}
