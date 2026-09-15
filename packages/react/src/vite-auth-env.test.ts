import { describe, expect, it } from "vitest";
import {
  collectViteAuthEnv,
  readViteAuthClientConfig,
  validateViteAuthEnv,
  ViteAuthEnvValidationError,
} from "./vite-auth-env.js";
import { authNinjaViteEnvPlugin } from "./vite-plugin.js";

const VALID_ENV = {
  VITE_AUTH_BASE_URL: "https://auth.example.com",
  VITE_OTHER: "ignored",
};

describe("validateViteAuthEnv", () => {
  it("accepts a valid minimal env", () => {
    const env = validateViteAuthEnv(VALID_ENV);
    expect(env.VITE_AUTH_BASE_URL).toBe("https://auth.example.com");
  });

  it("accepts optional session settings", () => {
    const env = validateViteAuthEnv({
      ...VALID_ENV,
      VITE_AUTH_SESSION_IDLE_MINUTES: "20",
      VITE_AUTH_SESSION_IDLE_REFRESH: "false",
      VITE_AUTH_SESSION_SYNC: "true",
    });

    expect(env.VITE_AUTH_SESSION_IDLE_MINUTES).toBe(20);
    expect(env.VITE_AUTH_SESSION_IDLE_REFRESH).toBe(false);
    expect(env.VITE_AUTH_SESSION_SYNC).toBe(true);
  });

  it("defaults to same-origin when VITE_AUTH_BASE_URL is unset", () => {
    const env = validateViteAuthEnv({});
    expect(env.VITE_AUTH_BASE_URL).toBe("");
    expect(readViteAuthClientConfig({})).toEqual({
      baseUrl: "",
      sessionIdleMinutes: 15,
    });
  });

  it("rejects invalid base URLs", () => {
    expect(() =>
      validateViteAuthEnv({
        VITE_AUTH_BASE_URL: "not-a-url",
      }),
    ).toThrow(/valid URL/);
  });

  it("rejects non-positive session idle minutes", () => {
    expect(() =>
      validateViteAuthEnv({
        ...VALID_ENV,
        VITE_AUTH_SESSION_IDLE_MINUTES: "0",
      }),
    ).toThrow(/positive integer/);
  });

  it("rejects unknown VITE_AUTH_* keys", () => {
    expect(() =>
      validateViteAuthEnv({
        ...VALID_ENV,
        VITE_AUTH_CUSTOM_FLAG: "true",
      }),
    ).toThrow(/Unknown VITE_AUTH_\* variable/);
  });

  it("rejects secret-like VITE_AUTH_* keys before allowlist check", () => {
    expect(() =>
      validateViteAuthEnv({
        ...VALID_ENV,
        VITE_AUTH_API_KEY: "leaked",
      }),
    ).toThrow(/not allowed in the client bundle/);
  });

  it("rejects VITE_AUTH_* keys containing SECRET", () => {
    expect(() =>
      validateViteAuthEnv({
        ...VALID_ENV,
        VITE_AUTH_NINJA_SECRET: "do-not-ship",
      }),
    ).toThrow(/not allowed in the client bundle/);
  });
});

describe("collectViteAuthEnv", () => {
  it("ignores empty values and unrelated keys", () => {
    expect(
      collectViteAuthEnv({
        VITE_AUTH_BASE_URL: "https://auth.example.com",
        VITE_AUTH_SESSION_IDLE_MINUTES: "  ",
        NODE_ENV: "test",
      }),
    ).toEqual({
      VITE_AUTH_BASE_URL: "https://auth.example.com",
    });
  });
});

describe("readViteAuthClientConfig", () => {
  it("maps env to AuthProvider-friendly config", () => {
    const config = readViteAuthClientConfig({
      VITE_AUTH_BASE_URL: "https://auth.example.com/",
      VITE_AUTH_SESSION_IDLE_MINUTES: "30",
      VITE_AUTH_SESSION_SYNC: "false",
    });

    expect(config).toEqual({
      baseUrl: "https://auth.example.com",
      sessionIdleMinutes: 30,
      sessionSync: false,
    });
  });
});

describe("authNinjaViteEnvPlugin", () => {
  it("allows same-origin config when base URL is unset", () => {
    const plugin = authNinjaViteEnvPlugin({ env: {} });
    const result = plugin.config?.({}, { mode: "test", command: "build" } as never);
    expect(result).toEqual({
      define: {
        "import.meta.env.VITE_AUTH_BASE_URL": '""',
      },
    });
  });

  it("passes config when env is valid", () => {
    const plugin = authNinjaViteEnvPlugin({ env: VALID_ENV });
    expect(() =>
      plugin.config?.({}, { mode: "test", command: "build" } as never),
    ).not.toThrow();
  });

  it("injects validated env into import.meta.env defines", () => {
    const plugin = authNinjaViteEnvPlugin({ env: VALID_ENV });
    const result = plugin.config?.({}, { mode: "test", command: "build" } as never);

    expect(result).toEqual({
      define: {
        "import.meta.env.VITE_AUTH_BASE_URL": JSON.stringify(VALID_ENV.VITE_AUTH_BASE_URL),
      },
    });
  });
});
