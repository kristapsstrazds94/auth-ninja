import { useCallback, useMemo } from "react";
import {
  deletePasskey,
  listPasskeys,
  passkeyLoginBegin,
  passkeyLoginFinish,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
  type PasskeyCredential,
  type PasskeyListResponse,
  type PasskeyLoginBeginInput,
  type WebAuthnCredentialResponseJson,
  type WebAuthnOptionsResponse,
} from "./auth-passkeys.js";
import type { SessionResponse } from "./auth-session.js";
import { useAuthContext } from "./provider.js";

export type PasskeyState = {
  /** Fetch WebAuthn registration options from the server. */
  registerBegin(): Promise<WebAuthnOptionsResponse>;
  /** Complete passkey registration with the browser credential response. */
  registerFinish(response: WebAuthnCredentialResponseJson): Promise<PasskeyCredential>;
  /** Fetch WebAuthn authentication options (email optional for discoverable keys). */
  loginBegin(input?: PasskeyLoginBeginInput): Promise<WebAuthnOptionsResponse>;
  /** Complete passkey login with the browser assertion response. */
  loginFinish(response: WebAuthnCredentialResponseJson): Promise<SessionResponse>;
  /** List passkeys registered for the current user. */
  list(): Promise<PasskeyListResponse>;
  /** Remove a passkey by credential ID. */
  remove(credentialId: string): Promise<void>;
};

/** Headless hook for WebAuthn passkey protocol endpoints. */
export function usePasskey(): PasskeyState {
  const { client, establishSession, refreshSession } = useAuthContext();

  const registerBegin = useCallback(
    async () => passkeyRegisterBegin(client),
    [client],
  );

  const registerFinish = useCallback(
    async (response: WebAuthnCredentialResponseJson) => {
      const credential = await passkeyRegisterFinish(client, response);
      await refreshSession();
      return credential;
    },
    [client, refreshSession],
  );

  const loginBegin = useCallback(
    async (input?: PasskeyLoginBeginInput) => passkeyLoginBegin(client, input),
    [client],
  );

  const loginFinish = useCallback(
    async (response: WebAuthnCredentialResponseJson) => {
      const session = await passkeyLoginFinish(client, response);
      establishSession(session);
      return session;
    },
    [client, establishSession],
  );

  const list = useCallback(async () => listPasskeys(client), [client]);

  const remove = useCallback(
    async (credentialId: string) => {
      await deletePasskey(client, credentialId);
      await refreshSession();
    },
    [client, refreshSession],
  );

  return useMemo(
    () => ({
      registerBegin,
      registerFinish,
      loginBegin,
      loginFinish,
      list,
      remove,
    }),
    [registerBegin, registerFinish, loginBegin, loginFinish, list, remove],
  );
}
