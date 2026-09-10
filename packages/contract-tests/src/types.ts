export interface ContractScenario {
  id: string;
  name: string;
  variables?: Record<string, string>;
  steps: ContractStep[];
}

export interface ContractStep {
  name: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  /** Attach session cookie from a prior capture (default key: session). */
  session?: boolean | string;
  /** Require CSRF header on this step (default: true for POST/DELETE). */
  csrf?: boolean;
  /** Intentionally omit CSRF — used for negative CSRF guard tests. */
  skipCsrf?: boolean;
  expect: ContractExpect;
}

export interface ContractExpect {
  status: number;
  code?: string;
  body?: Record<string, unknown>;
  capture?: Record<string, string>;
}

export interface ContractDispatchInit {
  headers?: Record<string, string>;
  body?: unknown;
}

export type ContractDispatchFn = (
  method: string,
  path: string,
  init?: ContractDispatchInit,
) => Promise<Response>;

export interface ContractRunnerOptions {
  sessionCookieName: string;
  csrfHeaderName: string;
  generateTotp?: (secret: string) => string;
}
