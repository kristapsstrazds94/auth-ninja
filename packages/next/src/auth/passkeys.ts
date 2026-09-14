import {
  createAuthError,
  createLoginAuditEvent,
  type AuthNinjaConfig,
} from "@auth-ninja/core";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthNinjaContext } from "../context.js";
import { credentials, users } from "../db/schema.js";
import { WEBAUTHN_CHALLENGE_TTL_MS } from "../session/constants.js";
import type { CreatedSession } from "../session/service.js";
import { resolveSessionByToken, rotateSession } from "../session/service.js";
import { normalizeEmail } from "./email.js";
import { toSessionResponse } from "./user-response.js";
import {
  uuidToUserHandle,
  webAuthnOrigin,
  webAuthnRpId,
  webAuthnRpName,
} from "./webauthn-config.js";
import type { PasskeyLoginBeginRequest, WebAuthnFinishRequest } from "./validation.js";

export type PasskeyRegisterBeginSuccess = {
  status: 200;
  body: { options: Record<string, unknown> };
};

export type PasskeyRegisterBeginResult = PasskeyRegisterBeginSuccess;

export type PasskeyRegisterFinishSuccess = {
  status: 201;
  body: {
    credentialId: string;
    createdAt: string;
    nickname?: string;
  };
};

export type PasskeyRegisterFinishFailure = {
  status: 400;
  body: { code: "VALIDATION_ERROR"; message: string };
};

export type PasskeyRegisterFinishResult =
  | PasskeyRegisterFinishSuccess
  | PasskeyRegisterFinishFailure;

export type PasskeyLoginBeginSuccess = {
  status: 200;
  body: { options: Record<string, unknown> };
};

export type PasskeyLoginBeginFailure = {
  status: 400;
  body: { code: "VALIDATION_ERROR"; message: string };
};

export type PasskeyLoginBeginResult = PasskeyLoginBeginSuccess | PasskeyLoginBeginFailure;

export type PasskeyLoginFinishSuccess = {
  status: 200;
  body: ReturnType<typeof toSessionResponse>;
  session: CreatedSession;
};

export type PasskeyLoginFinishFailure = {
  status: 401 | 423;
  body: { code: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED"; message: string };
};

export type PasskeyLoginFinishResult = PasskeyLoginFinishSuccess | PasskeyLoginFinishFailure;

export type PasskeyListSuccess = {
  status: 200;
  body: {
    passkeys: Array<{
      credentialId: string;
      createdAt: string;
      nickname?: string;
    }>;
  };
};

export type PasskeyDeleteSuccess = { status: 204 };

export type PasskeyDeleteFailure = {
  status: 404;
  body: { code: "FORBIDDEN"; message: string };
};

export type PasskeyDeleteResult = PasskeyDeleteSuccess | PasskeyDeleteFailure;

function assertPasskeysEnabled(config: AuthNinjaConfig): void {
  if (!config.passkeysEnabled) {
    throw createAuthError("FORBIDDEN");
  }
}

function passkeyLockoutKey(userId: string): string {
  return `passkey:${userId}`;
}

type PasskeyCredentialDescriptor = {
  id: string;
  transports?: string[];
};

type WebAuthnRegistrationResponse = Parameters<
  typeof verifyRegistrationResponse
>[0]["response"];

type WebAuthnAuthenticationResponse = Parameters<
  typeof verifyAuthenticationResponse
>[0]["response"];

function parseTransports(raw: string | null): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function serializeTransports(transports?: string[]): string | null {
  if (!transports || transports.length === 0) {
    return null;
  }

  return JSON.stringify(transports);
}

async function loadUserPasskeyDescriptors(
  ctx: AuthNinjaContext,
  userId: string,
): Promise<PasskeyCredentialDescriptor[]> {
  const rows = await ctx.db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, "passkey")));

  return rows
    .filter((row) => row.credentialId !== null)
    .map((row) => ({
      id: row.credentialId!,
      transports: parseTransports(row.transports),
    }));
}

function toPasskeySummary(row: {
  credentialId: string | null;
  createdAt: Date;
  nickname: string | null;
}) {
  return {
    credentialId: row.credentialId!,
    createdAt: row.createdAt.toISOString(),
    ...(row.nickname ? { nickname: row.nickname } : {}),
  };
}

/** Begin WebAuthn registration for the authenticated user. */
export async function passkeyRegisterBegin(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  now: Date = new Date(),
): Promise<PasskeyRegisterBeginResult> {
  assertPasskeysEnabled(ctx.config);

  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);
  const excludeCredentials = await loadUserPasskeyDescriptors(ctx, user.id);

  const options = await generateRegistrationOptions({
    rpName: webAuthnRpName(ctx.config),
    rpID: webAuthnRpId(ctx.config),
    userName: user.email,
    userID: uuidToUserHandle(user.id),
    attestationType: "none",
    excludeCredentials: excludeCredentials as Parameters<
      typeof generateRegistrationOptions
    >[0]["excludeCredentials"],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await ctx.webAuthnChallenges.set(
    options.challenge,
    { kind: "register", userId: user.id },
    WEBAUTHN_CHALLENGE_TTL_MS,
    now,
  );

  return {
    status: 200,
    body: { options: options as unknown as Record<string, unknown> },
  };
}

/** Complete WebAuthn registration and persist the credential. */
export async function passkeyRegisterFinish(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  input: WebAuthnFinishRequest,
  now: Date = new Date(),
): Promise<PasskeyRegisterFinishResult> {
  assertPasskeysEnabled(ctx.config);

  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);
  const response = input.response as unknown as WebAuthnRegistrationResponse;
  const expectedChallenge = extractChallengeFromClientData(response.response.clientDataJSON);

  if (!expectedChallenge) {
    return validationFailure();
  }

  const storedChallenge = await ctx.webAuthnChallenges.consume(
    expectedChallenge,
    "register",
    now,
  );

  if (!storedChallenge || storedChallenge.userId !== user.id) {
    return validationFailure();
  }

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;

  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: webAuthnOrigin(ctx.config),
      expectedRPID: webAuthnRpId(ctx.config),
    });
  } catch {
    return validationFailure();
  }

  if (!verification.verified || !verification.registrationInfo) {
    return validationFailure();
  }

  const { credential } = verification.registrationInfo;
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString("base64");

  const [inserted] = await ctx.db
    .insert(credentials)
    .values({
      userId: user.id,
      type: "passkey",
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      counter: credential.counter,
      transports: serializeTransports(credential.transports),
    })
    .returning({
      credentialId: credentials.credentialId,
      createdAt: credentials.createdAt,
      nickname: credentials.nickname,
    });

  if (!inserted?.credentialId) {
    return validationFailure();
  }

  return {
    status: 201,
    body: toPasskeySummary(inserted),
  };
}

/** Begin WebAuthn authentication (email optional for discoverable credentials). */
export async function passkeyLoginBegin(
  ctx: AuthNinjaContext,
  input: PasskeyLoginBeginRequest = {},
  now: Date = new Date(),
): Promise<PasskeyLoginBeginResult> {
  assertPasskeysEnabled(ctx.config);

  let allowCredentials: PasskeyCredentialDescriptor[] | undefined;
  let userId: string | undefined;

  if (input.email) {
    const emailNormalized = normalizeEmail(input.email);
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, emailNormalized))
      .limit(1);

    if (user) {
      userId = user.id;
      allowCredentials = await loadUserPasskeyDescriptors(ctx, user.id);
      if (allowCredentials.length === 0) {
        allowCredentials = undefined;
        userId = undefined;
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: webAuthnRpId(ctx.config),
    allowCredentials: allowCredentials as Parameters<
      typeof generateAuthenticationOptions
    >[0]["allowCredentials"],
    userVerification: "preferred",
  });

  await ctx.webAuthnChallenges.set(
    options.challenge,
    { kind: "login", userId },
    WEBAUTHN_CHALLENGE_TTL_MS,
    now,
  );

  return {
    status: 200,
    body: { options: options as unknown as Record<string, unknown> },
  };
}

export type PasskeyLoginFinishInput = WebAuthnFinishRequest & {
  ipAddress: string;
  userAgent?: string;
  existingSessionToken?: string;
};

/** Complete WebAuthn authentication and establish a session. */
export async function passkeyLoginFinish(
  ctx: AuthNinjaContext,
  input: PasskeyLoginFinishInput,
  now: Date = new Date(),
): Promise<PasskeyLoginFinishResult> {
  assertPasskeysEnabled(ctx.config);

  const response = input.response as unknown as WebAuthnAuthenticationResponse;
  const expectedChallenge = extractChallengeFromClientData(response.response.clientDataJSON);

  if (!expectedChallenge) {
    return invalidCredentials();
  }

  const storedChallenge = await ctx.webAuthnChallenges.consume(
    expectedChallenge,
    "login",
    now,
  );

  if (!storedChallenge) {
    return invalidCredentials();
  }

  const [storedCredential] = await ctx.db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.type, "passkey"),
        eq(credentials.credentialId, response.id),
      ),
    )
    .limit(1);

  if (!storedCredential?.credentialId || !storedCredential.publicKey) {
    return invalidCredentials();
  }

  const userId = storedCredential.userId;

  if (storedChallenge.userId && storedChallenge.userId !== userId) {
    return invalidCredentials();
  }

  const key = passkeyLockoutKey(userId);

  try {
    await ctx.lockout.assertNotLocked(key, now);
  } catch {
    return {
      status: 423,
      body: {
        code: "ACCOUNT_LOCKED",
        message: createAuthError("ACCOUNT_LOCKED").message,
      },
    };
  }

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;

  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: webAuthnOrigin(ctx.config),
      expectedRPID: webAuthnRpId(ctx.config),
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, "base64"),
        counter: storedCredential.counter ?? 0,
        transports: parseTransports(storedCredential.transports) as NonNullable<
          NonNullable<Parameters<typeof verifyAuthenticationResponse>[0]["credential"]>["transports"]
        >,
      },
    });
  } catch {
    return recordPasskeyFailure(ctx, userId, input, now);
  }

  if (!verification.verified) {
    return recordPasskeyFailure(ctx, userId, input, now);
  }

  await ctx.lockout.recordSuccess(key);

  const { newCounter } = verification.authenticationInfo;

  await ctx.db
    .update(credentials)
    .set({ counter: newCounter, lastUsedAt: now })
    .where(eq(credentials.id, storedCredential.id));

  const [user] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return invalidCredentials();
  }

  const session = await rotateSession(
    ctx.db,
    ctx.config,
    user.id,
    input.existingSessionToken,
    { ipAddress: input.ipAddress, userAgent: input.userAgent },
    now,
  );

  const audit = createLoginAuditEvent({
    outcome: "success",
    userId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await persistAuditEvent(ctx.db, audit);

  return {
    status: 200,
    body: toSessionResponse(user, ctx.config),
    session,
  };
}

/** List passkeys registered to the authenticated user. */
export async function listPasskeys(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  now: Date = new Date(),
): Promise<PasskeyListSuccess> {
  assertPasskeysEnabled(ctx.config);

  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  const rows = await ctx.db
    .select({
      credentialId: credentials.credentialId,
      createdAt: credentials.createdAt,
      nickname: credentials.nickname,
    })
    .from(credentials)
    .where(and(eq(credentials.userId, user.id), eq(credentials.type, "passkey")));

  return {
    status: 200,
    body: {
      passkeys: rows
        .filter((row) => row.credentialId !== null)
        .map((row) => toPasskeySummary(row)),
    },
  };
}

/** Remove a passkey owned by the authenticated user. */
export async function deletePasskey(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  credentialId: string,
  now: Date = new Date(),
): Promise<PasskeyDeleteResult> {
  assertPasskeysEnabled(ctx.config);

  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  const [row] = await ctx.db
    .select({ id: credentials.id })
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, user.id),
        eq(credentials.type, "passkey"),
        eq(credentials.credentialId, credentialId),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      status: 404,
      body: {
        code: "FORBIDDEN",
        message: "Unable to remove passkey.",
      },
    };
  }

  await ctx.db.delete(credentials).where(eq(credentials.id, row.id));

  return { status: 204 };
}

function validationFailure(): PasskeyRegisterFinishFailure {
  return {
    status: 400,
    body: {
      code: "VALIDATION_ERROR",
      message: createAuthError("VALIDATION_ERROR").message,
    },
  };
}

function invalidCredentials(): PasskeyLoginFinishFailure {
  return {
    status: 401,
    body: {
      code: "INVALID_CREDENTIALS",
      message: createAuthError("INVALID_CREDENTIALS").message,
    },
  };
}

async function recordPasskeyFailure(
  ctx: AuthNinjaContext,
  userId: string,
  input: PasskeyLoginFinishInput,
  now: Date,
): Promise<PasskeyLoginFinishFailure> {
  const key = passkeyLockoutKey(userId);
  const failure = await ctx.lockout.recordFailure(key, now);

  const audit = createLoginAuditEvent({
    outcome: "failure",
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await persistAuditEvent(ctx.db, audit);

  if (failure.locked) {
    return {
      status: 423,
      body: {
        code: "ACCOUNT_LOCKED",
        message: createAuthError("ACCOUNT_LOCKED").message,
      },
    };
  }

  return invalidCredentials();
}

/** Decode clientDataJSON and return the embedded challenge (base64url). */
function extractChallengeFromClientData(clientDataJSON: string): string | undefined {
  try {
    const json = JSON.parse(
      Buffer.from(clientDataJSON, "base64url").toString("utf8"),
    ) as { challenge?: string };

    return typeof json.challenge === "string" ? json.challenge : undefined;
  } catch {
    return undefined;
  }
}
