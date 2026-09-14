"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@auth-ninja/react";
import { AuthDemoCard } from "@/components/auth-demo-card";
import { AuthPageShell } from "@/components/auth-page-shell";
import { formatAuthError } from "@/lib/auth-error";

export function RegisterPage() {
  const { register } = useAuth();
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
      await register({ email, password });
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
        title="Register"
        footer={
          <p className="muted auth-demo-footer">
            Already have an account? <Link href="/login">Log in</Link>
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="btn-group">
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </div>
        </form>
      </AuthDemoCard>
    </AuthPageShell>
  );
}
