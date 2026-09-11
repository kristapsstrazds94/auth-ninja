import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { use2FA } from "@auth-ninja/react";
import { formatAuthError } from "../lib/auth-error";

type VerifyLocationState = {
  loginToken?: string;
};

export function TwoFaVerifyPage() {
  const location = useLocation();
  const loginToken = (location.state as VerifyLocationState | null)?.loginToken;

  if (!loginToken) {
    return <Navigate to="/login" replace />;
  }

  return <TwoFaVerifyForm loginToken={loginToken} />;
}

function TwoFaVerifyForm({ loginToken }: { loginToken: string }) {
  const navigate = useNavigate();
  const twoFa = use2FA();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await twoFa.verifyLogin({ loginToken, code });
      navigate("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h1>Two-factor verification</h1>
      <p className="muted">Enter the 6-digit code from your authenticator app.</p>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          TOTP code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
      <p className="muted">
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
