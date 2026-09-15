import { useCallback, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  type PasskeyCredential,
  useAuth,
  usePasskey,
} from "@auth-ninja/react";
import { AuthDemoCard } from "../components/AuthDemoCard";
import { AuthPageShell } from "../components/AuthPageShell";
import { DemoConsoleCard } from "../components/DemoConsoleCard";
import { Protected } from "../components/Protected";
import { formatAuthError } from "../lib/auth-error";
import {
  performPasskeyAuthentication,
  performPasskeyRegistration,
} from "../lib/webauthn";

export function PasskeysPage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <PasskeyLoginPanel />;
  }

  return (
    <Protected>
      <PasskeyManagePanel />
    </Protected>
  );
}

function PasskeyLoginPanel() {
  const passkey = usePasskey();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <AuthPageShell showLogo={false}>
      <AuthDemoCard
        title="Passkeys"
        footer={
          <p className="muted auth-demo-footer">
            Prefer password login? <Link to="/login">Log in</Link>
          </p>
        }
      >
        <div className="auth-demo-form stack">
          <label>
            Email (optional)
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-block"
              disabled={busy}
              onClick={() => void handlePasskeyLogin()}
            >
              {busy ? "Waiting for passkey…" : "Sign in with passkey"}
            </button>
          </div>
        </div>
      </AuthDemoCard>
    </AuthPageShell>
  );
}

function PasskeyManagePanel() {
  const passkey = usePasskey();
  const [items, setItems] = useState<PasskeyCredential[]>([]);
  const [listReady, setListReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await passkey.list();
    setItems(result.passkeys);
  }, [passkey]);

  useLayoutEffect(() => {
    let cancelled = false;

    void refresh()
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(formatAuthError(cause));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (!listReady) {
    return null;
  }

  async function handleRegister() {
    setError(null);
    setBusy(true);

    try {
      const { options } = await passkey.registerBegin();
      const response = await performPasskeyRegistration(options);
      await passkey.registerFinish(response);
      await refresh();
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(credentialId: string) {
    setError(null);
    setBusy(true);

    try {
      await passkey.remove(credentialId);
      await refresh();
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DemoConsoleCard chromeTitle="auth-ninja.demo / passkeys">
      <header className="demo-console-header">
        <h1>Passkeys</h1>
        <p>Register WebAuthn credentials for passwordless sign-in on supported devices.</p>
      </header>

      <div className="demo-console-actions row">
        <button type="button" className="btn" disabled={busy} onClick={() => void handleRegister()}>
          {busy ? "Waiting for passkey…" : "Register passkey"}
        </button>
        <span className={`badge ${items.length > 0 ? "badge-success" : "badge-muted"}`}>
          {items.length > 0 ? `${items.length} registered` : "None registered"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="stat-card">
          <p className="stat-card-title">No passkeys yet</p>
          <p className="stat-card-desc">
            Click &quot;Register passkey&quot; to add your first credential. You can remove
            credentials at any time.
          </p>
        </div>
      ) : (
        <ul className="credential-list">
          {items.map((item) => (
            <li key={item.credentialId} className="credential-item">
              <code>{item.credentialId}</code>
              <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void handleRemove(item.credentialId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="error">{error}</p> : null}

      <p className="demo-console-footer-link muted">
        <Link to="/">Back to dashboard</Link>
      </p>
    </DemoConsoleCard>
  );
}
