"use client";

import Link from "next/link";
import { useAuth } from "@auth-ninja/react";

function userInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

export function HomePage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <div className="card stack">
        <header className="page-header">
          <h1>Auth-Ninja demo</h1>
          <p>
            A full-stack reference app for testing secure authentication flows. Wire up the
            headless hooks in your own product UI.
          </p>
        </header>

        <div className="hero-actions">
          <Link href="/register" className="btn">
            Create account
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Log in
          </Link>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <p className="stat-card-title">Password + session auth</p>
            <p className="stat-card-desc">
              HttpOnly cookies, CSRF protection, and generic error responses.
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-card-title">MFA & passkeys</p>
            <p className="stat-card-desc">
              TOTP enrollment with backup codes and WebAuthn credential management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card stack">
        <header className="page-header">
          <h1>Signed in</h1>
          <p>Your session is active. Manage security settings from the dashboard below.</p>
        </header>

        <div className="user-banner">
          <span className="user-avatar" aria-hidden="true">
            {userInitial(user.email)}
          </span>
          <div>
            <p className="user-email">{user.email}</p>
            <p className="user-meta">Authenticated via Auth-Ninja session cookie</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <p className="stat-card-title">Two-factor authentication</p>
            <span className={`badge ${user.mfaEnabled ? "badge-success" : "badge-muted"}`}>
              {user.mfaEnabled ? "Enabled" : "Off"}
            </span>
          </div>
          <p className="stat-card-desc">
            {user.mfaEnabled
              ? "Your account requires a TOTP code at sign-in."
              : "Add an authenticator app for an extra layer of protection."}
          </p>
          <Link href="/2fa" className="btn btn-secondary">
            {user.mfaEnabled ? "Manage 2FA" : "Set up 2FA"}
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <p className="stat-card-title">Passkeys</p>
            <span className={`badge ${user.passkeysEnabled ? "badge-success" : "badge-muted"}`}>
              {user.passkeysEnabled ? "Registered" : "None"}
            </span>
          </div>
          <p className="stat-card-desc">
            {user.passkeysEnabled
              ? "You can sign in with a registered WebAuthn credential."
              : "Register a passkey for passwordless sign-in."}
          </p>
          <Link href="/passkeys" className="btn btn-secondary">
            {user.passkeysEnabled ? "Manage passkeys" : "Add passkey"}
          </Link>
        </div>
      </div>
    </div>
  );
}
