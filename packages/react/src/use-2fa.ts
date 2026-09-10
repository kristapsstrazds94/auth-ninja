import { useCallback } from "react";
import {
  confirm2fa,
  disable2fa,
  enroll2fa,
  regenerateBackupCodes,
  verify2faLogin,
  type BackupCodesResponse,
  type Disable2faInput,
  type TotpConfirmResponse,
  type TotpEnrollResponse,
  type TotpVerifyInput,
} from "./auth-2fa.js";
import type { SessionResponse } from "./auth-session.js";
import { useAuthContext } from "./provider.js";

export type TwoFaState = {
  /** Begin TOTP enrollment — returns secret and otpauth URL (shown once). */
  enroll(): Promise<TotpEnrollResponse>;
  /** Confirm enrollment with a TOTP code; returns backup codes. */
  confirm(code: string): Promise<TotpConfirmResponse>;
  /** Complete login when MFA is required after password step. */
  verifyLogin(input: TotpVerifyInput): Promise<SessionResponse>;
  /** Regenerate backup codes after password verification. */
  regenerateBackupCodes(password: string): Promise<BackupCodesResponse>;
  /** Disable TOTP after password and code or backup code verification. */
  disable(input: Disable2faInput): Promise<void>;
};

/** Headless hook for TOTP 2FA protocol endpoints. */
export function use2FA(): TwoFaState {
  const { client, establishSession, refreshSession } = useAuthContext();

  const enroll = useCallback(async () => enroll2fa(client), [client]);

  const confirm = useCallback(
    async (code: string) => {
      const result = await confirm2fa(client, code);
      await refreshSession();
      return result;
    },
    [client, refreshSession],
  );

  const verifyLogin = useCallback(
    async (input: TotpVerifyInput) => {
      const session = await verify2faLogin(client, input);
      establishSession(session);
      return session;
    },
    [client, establishSession],
  );

  const regenerate = useCallback(
    async (password: string) => regenerateBackupCodes(client, password),
    [client],
  );

  const disable = useCallback(
    async (input: Disable2faInput) => {
      await disable2fa(client, input);
      await refreshSession();
    },
    [client, refreshSession],
  );

  return {
    enroll,
    confirm,
    verifyLogin,
    regenerateBackupCodes: regenerate,
    disable,
  };
}
