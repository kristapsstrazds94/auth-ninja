import type { AuditEvent } from "@auth-ninja/core";
import type { AuthDb } from "../db/client.js";
import { auditEvents } from "../db/schema.js";

function auditPayload(event: AuditEvent): Record<string, unknown> {
  switch (event.type) {
    case "login":
      return { outcome: event.outcome };
    case "logout":
      return {};
    case "lockout":
      return {
        attemptCount: event.attemptCount,
        ...(event.unlockAt !== undefined ? { unlockAt: event.unlockAt } : {}),
      };
    case "ip":
      return {
        reason: event.reason,
        ...(event.previousIpAddress !== undefined
          ? { previousIpAddress: event.previousIpAddress }
          : {}),
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Persist a core audit event to the database. */
export async function persistAuditEvent(db: AuthDb, event: AuditEvent): Promise<void> {
  await db.insert(auditEvents).values({
    id: event.id,
    type: event.type,
    occurredAt: new Date(event.occurredAt),
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    userId: "userId" in event ? event.userId : undefined,
    payload: auditPayload(event),
  });
}
