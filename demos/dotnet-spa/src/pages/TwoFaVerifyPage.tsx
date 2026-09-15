import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { use2FA } from "@auth-ninja/react";
import { AuthPageShell } from "../components/AuthPageShell";
import { formatAuthError } from "../lib/auth-error";

export function TwoFaVerifyPage() {
  const [searchParams] = useSearchParams();
  const loginToken = searchParams.get("loginToken");
  const navigate = useNavigate();

  useEffect(() => {
    if (!loginToken) {
      navigate("/login", { replace: true });
    }
  }, [loginToken, navigate]);

  if (!loginToken) {
    return null;
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
    <AuthPageShell>
      <div className="card stack">
        <header className="page-header">
          <h1>Two-factor verification</h1>
          <p>Enter the 6-digit code from your authenticator app to complete sign-in.</p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <label>
            TOTP code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>

        <p className="muted">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
