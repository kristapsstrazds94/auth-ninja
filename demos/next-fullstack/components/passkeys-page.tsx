"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type PasskeyCredential,
  useAuth,
  usePasskey,
} from "@auth-ninja/react";
import { Protected } from "@/components/protected";
import { formatAuthError } from "@/lib/auth-error";
import {
  performPasskeyAuthentication,
  performPasskeyRegistration,
} from "@/lib/webauthn";

export function PasskeysPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p className="muted">Checking session…</p>;
  }

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
  const router = useRouter();
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
      router.push("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h1>Passkey login</h1>
      <p className="muted">
        Sign in with a registered passkey. Email is optional for discoverable credentials.
      </p>
      <label>
        Email (optional)
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void handlePasskeyLogin()}>
        {busy ? "Waiting for passkey…" : "Sign in with passkey"}
      </button>
      <p className="muted">
        Prefer password login? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}

function PasskeyManagePanel() {
  const passkey = usePasskey();
  const [items, setItems] = useState<PasskeyCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await passkey.list();
    setItems(result.passkeys);
  }, [passkey]);

  useEffect(() => {
    void refresh().catch((cause: unknown) => {
      setError(formatAuthError(cause));
    });
  }, [refresh]);

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
    <div className="card stack">
      <h1>Passkeys</h1>
      <button type="button" disabled={busy} onClick={() => void handleRegister()}>
        {busy ? "Waiting for passkey…" : "Register passkey"}
      </button>
      {items.length === 0 ? (
        <p className="muted">No passkeys registered yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.credentialId} className="row">
              <code>{item.credentialId}</code>
              <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              <button
                type="button"
                className="secondary"
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
    </div>
  );
}
