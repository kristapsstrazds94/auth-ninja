"use client";

import { FormEvent, useState } from "react";
import { useAuth, use2FA } from "@auth-ninja/react";
import { Protected } from "@/components/protected";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { formatAuthError } from "@/lib/auth-error";

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
      <header className="page-header">
        <h1>Two-factor authentication</h1>
        <p>
          Protect your account with time-based one-time passwords from an authenticator app.
        </p>
      </header>

      <div className="stat-card">
        <div className="stat-card-header">
          <p className="stat-card-title">Current status</p>
          <span className={`badge ${mfaEnabled ? "badge-success" : "badge-muted"}`}>
            {mfaEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p className="stat-card-desc">
          {mfaEnabled
            ? "A valid TOTP code is required when signing in."
            : "2FA is not active on this account yet."}
        </p>
      </div>

      {!mfaEnabled && !secret ? (
        <button type="button" className="btn" disabled={busy} onClick={() => void handleEnroll()}>
          {busy ? "Starting enrollment…" : "Enroll TOTP"}
        </button>
      ) : null}

      {secret && otpauthUrl ? (
        <div className="stack card-section">
          <p className="muted">
            Scan the QR code below with Google Authenticator, 1Password, or another TOTP app,
            then enter the 6-digit code to finish setup.
          </p>

          <QrCodeDisplay value={otpauthUrl} />

          <details className="secret-fallback">
            <summary>Can&apos;t scan? Enter the secret manually</summary>
            <code>{secret}</code>
          </details>

          <form onSubmit={(event) => void handleConfirm(event)}>
            <label>
              Confirmation code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={confirmCode}
                onChange={(event) => setConfirmCode(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Confirming…" : "Confirm enrollment"}
            </button>
          </form>
        </div>
      ) : null}

      {backupCodes ? (
        <div className="stack card-section">
          <p className="muted">
            Save these backup codes in a secure place — they are shown only once and can be used
            if you lose access to your authenticator.
          </p>
          <ul className="backup-codes">
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mfaEnabled ? (
        <form className="stack card-section" onSubmit={(event) => void handleDisable(event)}>
          <h2>Disable 2FA</h2>
          <p className="muted">Confirm your password and current TOTP code to turn off MFA.</p>
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
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? "Disabling…" : "Disable 2FA"}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
