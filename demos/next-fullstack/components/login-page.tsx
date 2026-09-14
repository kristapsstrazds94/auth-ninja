"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMfaRequiredResponse, useAuth, usePasskey } from "@auth-ninja/react";
import { AuthDemoCard } from "@/components/auth-demo-card";
import { AuthPageShell } from "@/components/auth-page-shell";
import { formatAuthError } from "@/lib/auth-error";
import { performPasskeyAuthentication } from "@/lib/webauthn";

export function LoginPage() {
  const { login } = useAuth();
  const passkey = usePasskey();
  const router = useRouter();

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
        router.push(
          `/2fa/verify?loginToken=${encodeURIComponent(result.loginToken)}`,
        );
        return;
      }
      router.push("/");
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
      router.push("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell showLogo={false}>
      <AuthDemoCard
        title="Login"
        footer={
          <p className="muted auth-demo-footer">
            No account yet? <Link href="/register">Create one</Link>
          </p>
        }
      >
        <form className="auth-demo-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
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
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="btn-group">
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="divider-text">or</div>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={busy}
              onClick={() => void handlePasskeyLogin()}
            >
              {busy ? "Waiting for passkey…" : "Sign in with passkey"}
            </button>
          </div>
        </form>
      </AuthDemoCard>
    </AuthPageShell>
  );
}
