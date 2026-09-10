import { createIpAuditEvent, type AuthNinjaConfig } from "@auth-ninja/core";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthDb } from "../db/client.js";
import type { RequestMeta } from "../http/request-meta.js";

export type IpAuditHookResult = {
  blocked: boolean;
  reason?: "allowlist_violation";
};

function isIpAllowed(ipAddress: string, allowlist: string[] | undefined): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(ipAddress);
}

/**
 * Enforce optional IP allowlist and persist IP audit events when policy triggers.
 * Returns `{ blocked: true }` when the client IP is not on the allowlist.
 */
export async function runIpAuditHook(
  config: AuthNinjaConfig,
  db: AuthDb,
  meta: RequestMeta,
): Promise<IpAuditHookResult> {
  if (!config.ipAuditEnabled) {
    return { blocked: false };
  }

  if (!isIpAllowed(meta.ipAddress, config.ipAllowlist)) {
    const audit = createIpAuditEvent({
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reason: "allowlist_violation",
    });
    await persistAuditEvent(db, audit);
    return { blocked: true, reason: "allowlist_violation" };
  }

  return { blocked: false };
}

/** Record a suspicious-activity IP audit event (e.g. after rate-limit breach). */
export async function recordSuspiciousIpAudit(
  config: AuthNinjaConfig,
  db: AuthDb,
  meta: RequestMeta,
): Promise<void> {
  if (!config.ipAuditEnabled) {
    return;
  }

  const audit = createIpAuditEvent({
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    reason: "suspicious_activity",
  });
  await persistAuditEvent(db, audit);
}
