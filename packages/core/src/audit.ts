import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthNinjaError } from "./errors.js";

/** Canonical audit event families — adapters persist these for repudiation and IP audit. */
export const AUDIT_EVENT_TYPES = [
  "login",
  "logout",
  "lockout",
  "ip",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** Reasons for IP audit events (suspicious or policy-driven). */
export const IP_AUDIT_REASONS = [
  "suspicious_activity",
  "allowlist_violation",
  "geo_anomaly",
  "new_ip",
] as const;

export type IpAuditReason = (typeof IP_AUDIT_REASONS)[number];

/**
 * Field names that must never appear in audit payloads (see docs/THREAT-MODEL.md).
 * Matching is case-insensitive on keys.
 */
export const AUDIT_FORBIDDEN_FIELD_NAMES = [
  "password",
  "passwordHash",
  "totpSecret",
  "totpSeed",
  "sessionId",
  "sessionToken",
  "recoveryCode",
  "backupCode",
  "authNinjaSecret",
  "secret",
  "token",
  "cookie",
  "csrfToken",
] as const;

const auditEventBaseSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
  ipAddress: z.string().min(1).max(45),
  userAgent: z.string().max(512).optional(),
});

export const loginAuditEventSchema = auditEventBaseSchema.extend({
  type: z.literal("login"),
  outcome: z.enum(["success", "failure"]),
  userId: z.string().uuid().optional(),
});

export const logoutAuditEventSchema = auditEventBaseSchema.extend({
  type: z.literal("logout"),
  userId: z.string().uuid(),
});

export const lockoutAuditEventSchema = auditEventBaseSchema.extend({
  type: z.literal("lockout"),
  userId: z.string().uuid(),
  attemptCount: z.number().int().positive(),
  unlockAt: z.string().datetime().optional(),
});

export const ipAuditEventSchema = auditEventBaseSchema.extend({
  type: z.literal("ip"),
  reason: z.enum(IP_AUDIT_REASONS),
  userId: z.string().uuid().optional(),
  previousIpAddress: z.string().min(1).max(45).optional(),
});

export const auditEventSchema = z.discriminatedUnion("type", [
  loginAuditEventSchema,
  logoutAuditEventSchema,
  lockoutAuditEventSchema,
  ipAuditEventSchema,
]);

export type LoginAuditEvent = z.infer<typeof loginAuditEventSchema>;
export type LogoutAuditEvent = z.infer<typeof logoutAuditEventSchema>;
export type LockoutAuditEvent = z.infer<typeof lockoutAuditEventSchema>;
export type IpAuditEvent = z.infer<typeof ipAuditEventSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;

export type AuditEventInput = Omit<AuditEvent, "id" | "occurredAt"> & {
  id?: string;
  occurredAt?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isForbiddenFieldName(key: string): boolean {
  const normalized = key.toLowerCase();
  return AUDIT_FORBIDDEN_FIELD_NAMES.some(
    (forbidden) => forbidden.toLowerCase() === normalized,
  );
}

function isEmptyPlainObject(value: unknown): boolean {
  return isPlainObject(value) && Object.keys(value).length === 0;
}

/** Remove forbidden keys from a nested object before building or persisting audit rows. */
export function sanitizeAuditPayload<T extends Record<string, unknown>>(payload: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (isForbiddenFieldName(key)) {
      continue;
    }

    if (isPlainObject(value)) {
      const sanitized = sanitizeAuditPayload(value);
      if (!isEmptyPlainObject(sanitized)) {
        result[key] = sanitized;
      }
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value
        .map((item) => (isPlainObject(item) ? sanitizeAuditPayload(item) : item))
        .filter((item) => !isEmptyPlainObject(item));
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

/** Throw if any forbidden field name appears anywhere in the payload tree. */
export function assertAuditPayloadSafe(payload: unknown): void {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      assertAuditPayloadSafe(item);
    }
    return;
  }

  if (!isPlainObject(payload)) {
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (isForbiddenFieldName(key)) {
      throw new AuthNinjaError(
        "VALIDATION_ERROR",
        "Audit payload must not contain sensitive fields",
        400,
      );
    }
    assertAuditPayloadSafe(value);
  }
}

/** Parse and validate a stored or wire-format audit event. */
export function parseAuditEvent(input: unknown): AuditEvent {
  assertAuditPayloadSafe(input);
  const result = auditEventSchema.safeParse(input);

  if (!result.success) {
    throw new AuthNinjaError("VALIDATION_ERROR", "Invalid audit event", 400);
  }

  return result.data;
}

function withAuditDefaults<T extends AuditEventInput>(input: T): T & {
  id: string;
  occurredAt: string;
} {
  return {
    ...input,
    id: input.id ?? randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

/** Build a login audit event (success or failure). Never include passwords. */
export function createLoginAuditEvent(
  input: Omit<LoginAuditEvent, "id" | "occurredAt" | "type"> & {
    id?: string;
    occurredAt?: string;
  },
): LoginAuditEvent {
  const payload = withAuditDefaults({ type: "login", ...input });
  assertAuditPayloadSafe(payload);
  return loginAuditEventSchema.parse(payload);
}

/** Build a logout audit event. */
export function createLogoutAuditEvent(
  input: Omit<LogoutAuditEvent, "id" | "occurredAt" | "type"> & {
    id?: string;
    occurredAt?: string;
  },
): LogoutAuditEvent {
  const payload = withAuditDefaults({ type: "logout", ...input });
  assertAuditPayloadSafe(payload);
  return logoutAuditEventSchema.parse(payload);
}

/** Build a lockout audit event after failed-attempt threshold. */
export function createLockoutAuditEvent(
  input: Omit<LockoutAuditEvent, "id" | "occurredAt" | "type"> & {
    id?: string;
    occurredAt?: string;
  },
): LockoutAuditEvent {
  const payload = withAuditDefaults({ type: "lockout", ...input });
  assertAuditPayloadSafe(payload);
  return lockoutAuditEventSchema.parse(payload);
}

/** Build an IP audit event (suspicious activity, allowlist violation, etc.). */
export function createIpAuditEvent(
  input: Omit<IpAuditEvent, "id" | "occurredAt" | "type"> & {
    id?: string;
    occurredAt?: string;
  },
): IpAuditEvent {
  const payload = withAuditDefaults({ type: "ip", ...input });
  assertAuditPayloadSafe(payload);
  return ipAuditEventSchema.parse(payload);
}
