"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use2FA } from "@auth-ninja/react";
import { AuthPageShell } from "@/components/auth-page-shell";
import { formatAuthError } from "@/lib/auth-error";

export function TwoFaVerifyPage() {
  const searchParams = useSearchParams();
  const loginToken = searchParams.get("loginToken");
  const router = useRouter();

  useEffect(() => {
    if (!loginToken) {
      router.replace("/login");
    }
  }, [loginToken, router]);

  if (!loginToken) {
    return null;
  }

  return <TwoFaVerifyForm loginToken={loginToken} />;
}

function TwoFaVerifyForm({ loginToken }: { loginToken: string }) {
  const router = useRouter();
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
      router.push("/");
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
          <Link href="/login">Back to login</Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
