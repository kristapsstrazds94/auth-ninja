"use client";

import Link from "next/link";
import { useAuth } from "@auth-ninja/react";

export function DemoNav() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <nav>
      <strong>Auth-Ninja</strong>
      {isLoading ? (
        <span className="muted">Loading session…</span>
      ) : isAuthenticated ? (
        <>
          <Link href="/">Home</Link>
          <Link href="/2fa">2FA</Link>
          <Link href="/passkeys">Passkeys</Link>
          <button type="button" className="secondary" onClick={() => void logout()}>
            Log out
          </button>
        </>
      ) : (
        <>
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
          <Link href="/passkeys">Passkeys</Link>
        </>
      )}
    </nav>
  );
}
