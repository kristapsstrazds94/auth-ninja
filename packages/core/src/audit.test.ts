import { describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_TYPES,
  AUDIT_FORBIDDEN_FIELD_NAMES,
  IP_AUDIT_REASONS,
  assertAuditPayloadSafe,
  createIpAuditEvent,
  createLockoutAuditEvent,
  createLoginAuditEvent,
  createLogoutAuditEvent,
  parseAuditEvent,
  sanitizeAuditPayload,
} from "./audit.js";
import { AuthNinjaError } from "./errors.js";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVENT_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const OCCURRED_AT = "2026-09-10T10:00:00.000Z";

describe("AUDIT_EVENT_TYPES", () => {
  it("includes login, logout, lockout, and ip", () => {
    expect(AUDIT_EVENT_TYPES).toEqual(["login", "logout", "lockout", "ip"]);
  });
});

describe("createLoginAuditEvent", () => {
  it("builds a successful login event with defaults", () => {
    const event = createLoginAuditEvent({
      outcome: "success",
      userId: USER_ID,
      ipAddress: "203.0.113.10",
    });

    expect(event.type).toBe("login");
    expect(event.outcome).toBe("success");
    expect(event.userId).toBe(USER_ID);
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("builds a failed login without userId", () => {
    const event = createLoginAuditEvent({
      id: EVENT_ID,
      occurredAt: OCCURRED_AT,
      outcome: "failure",
      ipAddress: "198.51.100.4",
      userAgent: "AuthNinjaTest/1.0",
    });

    expect(event).toEqual({
      id: EVENT_ID,
      occurredAt: OCCURRED_AT,
      type: "login",
      outcome: "failure",
      ipAddress: "198.51.100.4",
      userAgent: "AuthNinjaTest/1.0",
    });
  });
});

describe("createLogoutAuditEvent", () => {
  it("requires userId", () => {
    const event = createLogoutAuditEvent({
      id: EVENT_ID,
      occurredAt: OCCURRED_AT,
      userId: USER_ID,
      ipAddress: "203.0.113.10",
    });

    expect(event.type).toBe("logout");
    expect(event.userId).toBe(USER_ID);
  });
});

describe("createLockoutAuditEvent", () => {
  it("records attempt count and optional unlock time", () => {
    const unlockAt = "2026-09-10T10:30:00.000Z";
    const event = createLockoutAuditEvent({
      id: EVENT_ID,
      occurredAt: OCCURRED_AT,
      userId: USER_ID,
      ipAddress: "203.0.113.10",
      attemptCount: 5,
      unlockAt,
    });

    expect(event.type).toBe("lockout");
    expect(event.attemptCount).toBe(5);
    expect(event.unlockAt).toBe(unlockAt);
  });
});

describe("createIpAuditEvent", () => {
  it("supports all IP audit reasons", () => {
    for (const reason of IP_AUDIT_REASONS) {
      const event = createIpAuditEvent({
        id: EVENT_ID,
        occurredAt: OCCURRED_AT,
        reason,
        ipAddress: "203.0.113.10",
        previousIpAddress: "198.51.100.4",
      });

      expect(event.type).toBe("ip");
      expect(event.reason).toBe(reason);
    }
  });
});

describe("parseAuditEvent", () => {
  it("round-trips builder output", () => {
    const built = createLoginAuditEvent({
      id: EVENT_ID,
      occurredAt: OCCURRED_AT,
      outcome: "success",
      userId: USER_ID,
      ipAddress: "203.0.113.10",
    });

    expect(parseAuditEvent(built)).toEqual(built);
  });

  it("rejects unknown event type", () => {
    expect(() =>
      parseAuditEvent({
        id: EVENT_ID,
        occurredAt: OCCURRED_AT,
        type: "register",
        ipAddress: "203.0.113.10",
      }),
    ).toThrow(AuthNinjaError);
  });

  it("rejects invalid UUID for userId", () => {
    expect(() =>
      parseAuditEvent({
        id: EVENT_ID,
        occurredAt: OCCURRED_AT,
        type: "logout",
        userId: "not-a-uuid",
        ipAddress: "203.0.113.10",
      }),
    ).toThrow(AuthNinjaError);
  });
});

describe("sanitizeAuditPayload", () => {
  it("strips forbidden field names at any depth", () => {
    const sanitized = sanitizeAuditPayload({
      type: "login",
      ipAddress: "203.0.113.10",
      password: "hunter2",
      nested: {
        sessionId: "sess_abc",
        outcome: "failure",
      },
      items: [{ totpSecret: "JBSWY3DPEHPK3PXP" }, { ok: true }],
    });

    expect(sanitized).toEqual({
      type: "login",
      ipAddress: "203.0.113.10",
      nested: { outcome: "failure" },
      items: [{ ok: true }],
    });
  });

  it("matches forbidden names case-insensitively", () => {
    const sanitized = sanitizeAuditPayload({
      PASSWORD: "x",
      SessionToken: "y",
      ipAddress: "203.0.113.10",
    });

    expect(sanitized).toEqual({ ipAddress: "203.0.113.10" });
  });
});

describe("assertAuditPayloadSafe", () => {
  it("throws when a forbidden field is present", () => {
    for (const field of AUDIT_FORBIDDEN_FIELD_NAMES) {
      expect(() => assertAuditPayloadSafe({ [field]: "leak" })).toThrow(
        AuthNinjaError,
      );
    }
  });

  it("allows safe audit payloads", () => {
    expect(() =>
      assertAuditPayloadSafe({
        type: "logout",
        userId: USER_ID,
        ipAddress: "203.0.113.10",
      }),
    ).not.toThrow();
  });
});

describe("security", () => {
  it("rejects login events that include a password field", () => {
    expect(() =>
      createLoginAuditEvent({
        outcome: "failure",
        ipAddress: "203.0.113.10",
        password: "secret",
      } as never),
    ).toThrow(AuthNinjaError);
  });

  it("parseAuditEvent rejects payloads with sessionId", () => {
    expect(() =>
      parseAuditEvent({
        id: EVENT_ID,
        occurredAt: OCCURRED_AT,
        type: "login",
        outcome: "success",
        userId: USER_ID,
        ipAddress: "203.0.113.10",
        sessionId: "must-not-persist",
      }),
    ).toThrow(AuthNinjaError);
  });
});
