import { FormEvent, useState } from "react";
import { useAuth, use2FA } from "@auth-ninja/react";
import { Protected } from "../components/Layout";
import { formatAuthError } from "../lib/auth-error";

export function TwoFaPage() {
  return (
    <Protected>
      <TwoFaContent />
    </Protected>
  );
}

function TwoFaContent() {
  const { user } = useAuth();
  const twoFa = use2FA();

  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEnroll() {
    setError(null);
    setBusy(true);
    setBackupCodes(null);

    try {
      const result = await twoFa.enroll();
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const result = await twoFa.confirm(confirmCode);
      setBackupCodes(result.backupCodes);
      setSecret(null);
      setOtpauthUrl(null);
      setConfirmCode("");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await twoFa.disable({
        password: disablePassword,
        code: disableCode || undefined,
      });
      setDisablePassword("");
      setDisableCode("");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  const mfaEnabled = user?.mfaEnabled === true;

  return (
    <div className="card stack">
      <h1>Two-factor authentication</h1>
      <p className="muted">
        Status: <strong>{mfaEnabled ? "enabled" : "disabled"}</strong>
      </p>

      {!mfaEnabled && !secret ? (
        <button type="button" disabled={busy} onClick={() => void handleEnroll()}>
          {busy ? "Starting enrollment…" : "Enroll TOTP"}
        </button>
      ) : null}

      {secret ? (
        <div className="stack">
          <p className="muted">
            Add this secret to your authenticator app, then enter a code to confirm.
          </p>
          <code>{secret}</code>
          {otpauthUrl ? (
            <a href={otpauthUrl} target="_blank" rel="noreferrer">
              Open otpauth URL
            </a>
          ) : null}
          <form onSubmit={(event) => void handleConfirm(event)}>
            <label>
              Confirmation code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={confirmCode}
                onChange={(event) => setConfirmCode(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Confirming…" : "Confirm enrollment"}
            </button>
          </form>
        </div>
      ) : null}

      {backupCodes ? (
        <div className="stack">
          <p className="muted">Save these backup codes — they are shown once.</p>
          <ul>
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mfaEnabled ? (
        <form className="stack" onSubmit={(event) => void handleDisable(event)}>
          <h2>Disable 2FA</h2>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
              required
            />
          </label>
          <label>
            TOTP code
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="secondary" disabled={busy}>
            {busy ? "Disabling…" : "Disable 2FA"}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
