import { z } from "zod";
import { DEFAULT_SESSION_IDLE_MINUTES } from "./session-idle.js";

/** Prefix for client-exposed Auth-Ninja env vars in Vite apps. */
export const VITE_AUTH_ENV_PREFIX = "VITE_AUTH_";

/** Allowlisted `VITE_AUTH_*` keys — public client config only (no secrets). */
export const VITE_AUTH_ALLOWED_KEYS = [
  "VITE_AUTH_BASE_URL",
  "VITE_AUTH_SESSION_IDLE_MINUTES",
  "VITE_AUTH_SESSION_IDLE_REFRESH",
  "VITE_AUTH_SESSION_SYNC",
] as const;

export type ViteAuthEnvKey = (typeof VITE_AUTH_ALLOWED_KEYS)[number];

const FORBIDDEN_KEY_FRAGMENTS = [
  "SECRET",
  "PASSWORD",
  "PRIVATE",
  "TOKEN",
  "API_KEY",
  "APIKEY",
] as const;

const boolEnvSchema = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((value) => value === "true" || value === "1" || value === "yes");

export const viteAuthEnvSchema = z.object({
  /** Empty string = same-origin (use with a Vite `/auth` dev proxy). */
  VITE_AUTH_BASE_URL: z.union([
    z.literal(""),
    z.string().url("VITE_AUTH_BASE_URL must be a valid URL"),
  ]),
  VITE_AUTH_SESSION_IDLE_MINUTES: z.coerce
    .number()
    .int()
    .positive("VITE_AUTH_SESSION_IDLE_MINUTES must be a positive integer")
    .optional(),
  VITE_AUTH_SESSION_IDLE_REFRESH: boolEnvSchema.optional(),
  VITE_AUTH_SESSION_SYNC: boolEnvSchema.optional(),
});

export type ViteAuthEnv = z.infer<typeof viteAuthEnvSchema>;

export type ViteAuthClientConfig = {
  baseUrl: string;
  sessionIdleMinutes: number;
  sessionIdleRefresh?: boolean;
  sessionSync?: boolean;
};

export class ViteAuthEnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViteAuthEnvValidationError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

/** Collect non-empty `VITE_AUTH_*` entries from a flat env record. */
export function collectViteAuthEnv(
  env: Record<string, string | undefined>,
): Partial<Record<ViteAuthEnvKey, string>> {
  const allowed = new Set<string>(VITE_AUTH_ALLOWED_KEYS);
  const collected: Partial<Record<ViteAuthEnvKey, string>> = {};

  for (const [key, rawValue] of Object.entries(env)) {
    if (!key.startsWith(VITE_AUTH_ENV_PREFIX) || !isNonEmpty(rawValue)) {
      continue;
    }

    const upperKey = key.toUpperCase();

    for (const fragment of FORBIDDEN_KEY_FRAGMENTS) {
      if (upperKey.includes(fragment)) {
        throw new ViteAuthEnvValidationError(
          `${key} is not allowed in the client bundle — never expose secrets via VITE_* variables.`,
        );
      }
    }

    if (!allowed.has(key)) {
      throw new ViteAuthEnvValidationError(
        `Unknown ${VITE_AUTH_ENV_PREFIX}* variable "${key}". Allowed keys: ${VITE_AUTH_ALLOWED_KEYS.join(", ")}.`,
      );
    }

    collected[key as ViteAuthEnvKey] = rawValue.trim();
  }

  return collected;
}

/**
 * Validate `VITE_AUTH_*` variables. Throws {@link ViteAuthEnvValidationError} when invalid.
 * When `VITE_AUTH_BASE_URL` is unset, uses same-origin relative `/auth` requests (Vite proxy).
 */
export function validateViteAuthEnv(
  env: Record<string, string | undefined>,
): ViteAuthEnv {
  const collected = collectViteAuthEnv(env);
  const withDefaults = {
    VITE_AUTH_BASE_URL: collected.VITE_AUTH_BASE_URL ?? "",
    ...collected,
  };

  const parsed = viteAuthEnvSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const detail = parsed.error.errors.map((issue) => issue.message).join("; ");
    throw new ViteAuthEnvValidationError(detail);
  }

  return parsed.data;
}

/** Map validated Vite env to values suitable for {@link AuthProvider}. */
export function viteAuthEnvToClientConfig(env: ViteAuthEnv): ViteAuthClientConfig {
  return {
    baseUrl: normalizeBaseUrl(env.VITE_AUTH_BASE_URL),
    sessionIdleMinutes:
      env.VITE_AUTH_SESSION_IDLE_MINUTES ?? DEFAULT_SESSION_IDLE_MINUTES,
    ...(env.VITE_AUTH_SESSION_IDLE_REFRESH !== undefined && {
      sessionIdleRefresh: env.VITE_AUTH_SESSION_IDLE_REFRESH,
    }),
    ...(env.VITE_AUTH_SESSION_SYNC !== undefined && {
      sessionSync: env.VITE_AUTH_SESSION_SYNC,
    }),
  };
}

/** Read `import.meta.env` style records (e.g. in a Vite SPA entry). */
export function readViteAuthClientConfig(
  env: Record<string, string | undefined>,
): ViteAuthClientConfig {
  return viteAuthEnvToClientConfig(validateViteAuthEnv(env));
}
