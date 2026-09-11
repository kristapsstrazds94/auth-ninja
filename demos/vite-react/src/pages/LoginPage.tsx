import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isMfaRequiredResponse, useAuth, usePasskey } from "@auth-ninja/react";
import { formatAuthError } from "../lib/auth-error";
import {
  performPasskeyAuthentication,
} from "../lib/webauthn";

export function LoginPage() {
  const { login } = useAuth();
  const passkey = usePasskey();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const result = await login({ email, password });
      if (isMfaRequiredResponse(result)) {
        navigate("/2fa/verify", { state: { loginToken: result.loginToken } });
        return;
      }
      navigate("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeyLogin() {
    setError(null);
    setBusy(true);

    try {
      const { options } = await passkey.loginBegin(
        email.trim() ? { email: email.trim() } : undefined,
      );
      const response = await performPasskeyAuthentication(options);
      await passkey.loginFinish(response);
      navigate("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h1>Log in</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void handlePasskeyLogin()}
          >
            Sign in with passkey
          </button>
        </div>
      </form>
      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
