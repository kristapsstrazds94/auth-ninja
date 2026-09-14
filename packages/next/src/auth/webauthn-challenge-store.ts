/** WebAuthn ceremony type stored with the challenge. */
export type WebAuthnChallengeKind = "register" | "login";

export type WebAuthnChallengeRecord = {
  kind: WebAuthnChallengeKind;
  /** Set for registration and email-scoped login; resolved from credential on discoverable login. */
  userId?: string;
  expiresAt: number;
};

export type WebAuthnChallengeStore = {
  set(
    challenge: string,
    record: Omit<WebAuthnChallengeRecord, "expiresAt">,
    ttlMs: number,
    now?: Date,
  ): void | Promise<void>;
  consume(
    challenge: string,
    kind: WebAuthnChallengeKind,
    now?: Date,
  ): WebAuthnChallengeRecord | undefined | Promise<WebAuthnChallengeRecord | undefined>;
};

type StoredChallenge = WebAuthnChallengeRecord;

/** In-memory WebAuthn challenge store with short TTL (single-process dev default). */
export class InMemoryWebAuthnChallengeStore implements WebAuthnChallengeStore {
  private readonly entries = new Map<string, StoredChallenge>();

  set(
    challenge: string,
    record: Omit<WebAuthnChallengeRecord, "expiresAt">,
    ttlMs: number,
    now: Date = new Date(),
  ): void {
    this.entries.set(challenge, {
      ...record,
      expiresAt: now.getTime() + ttlMs,
    });
  }

  consume(
    challenge: string,
    kind: WebAuthnChallengeKind,
    now: Date = new Date(),
  ): WebAuthnChallengeRecord | undefined {
    const entry = this.entries.get(challenge);

    if (!entry || entry.kind !== kind || now.getTime() > entry.expiresAt) {
      this.entries.delete(challenge);
      return undefined;
    }

    this.entries.delete(challenge);
    return entry;
  }
}
