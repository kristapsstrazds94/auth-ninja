"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@auth-ninja/react";
import { DemoNav } from "@/components/demo-nav";
import { Spinner } from "@/components/spinner";
import { formatAuthError } from "@/lib/auth-error";
import { isAuthLayoutPath, isCenteredAuthPath } from "@/lib/auth-routes";

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, sessionError, refreshSession, isAuthenticated } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const pending = isLoading || retrying;
  const hideNav = isAuthLayoutPath(pathname);
  const centeredAuth =
    isCenteredAuthPath(pathname) ||
    (pathname.startsWith("/passkeys") && !isAuthenticated);
  /** Login/register do not need a session check before first paint. */
  const skipSessionGate = isCenteredAuthPath(pathname);

  async function handleRetry() {
    setRetrying(true);
    try {
      await refreshSession();
    } catch {
      // sessionError is updated by AuthProvider
    } finally {
      setRetrying(false);
    }
  }

  if (pending && !skipSessionGate) {
    return (
      <div className="app-shell-loading">
        <Spinner label="Loading session…" size="lg" centered />
      </div>
    );
  }

  if (sessionError && !skipSessionGate) {
    return (
      <div className="app-shell-loading">
        <div className="card stack app-shell-error">
          <h1>Unable to load session</h1>
          <p className="muted">The demo could not reach the auth API. Check that the server is running.</p>
          <p className="error">{formatAuthError(sessionError)}</p>
          <button type="button" className="btn" onClick={() => void handleRetry()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {hideNav ? null : <DemoNav />}
      <main className={centeredAuth ? "main-auth" : undefined}>{children}</main>
    </>
  );
}
