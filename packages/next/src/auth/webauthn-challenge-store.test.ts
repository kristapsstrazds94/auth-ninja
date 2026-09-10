import { describe, expect, it } from "vitest";
import { InMemoryWebAuthnChallengeStore } from "./webauthn-challenge-store.js";
import { WEBAUTHN_CHALLENGE_TTL_MS } from "../session/constants.js";

describe("InMemoryWebAuthnChallengeStore", () => {
  it("stores and consumes a challenge once", () => {
    const store = new InMemoryWebAuthnChallengeStore();
    const now = new Date("2026-01-01T00:00:00.000Z");

    store.set("challenge-1", { kind: "register", userId: "user-1" }, WEBAUTHN_CHALLENGE_TTL_MS, now);

    const consumed = store.consume("challenge-1", "register", now);
    expect(consumed?.userId).toBe("user-1");

    expect(store.consume("challenge-1", "register", now)).toBeUndefined();
  });

  it("rejects expired challenges", () => {
    const store = new InMemoryWebAuthnChallengeStore();
    const now = new Date("2026-01-01T00:00:00.000Z");

    store.set("challenge-2", { kind: "login" }, WEBAUTHN_CHALLENGE_TTL_MS, now);

    const expiredAt = new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS + 1);
    expect(store.consume("challenge-2", "login", expiredAt)).toBeUndefined();
  });

  it("rejects wrong ceremony kind", () => {
    const store = new InMemoryWebAuthnChallengeStore();

    store.set("challenge-3", { kind: "register", userId: "user-1" }, WEBAUTHN_CHALLENGE_TTL_MS);

    expect(store.consume("challenge-3", "login")).toBeUndefined();
  });
});
