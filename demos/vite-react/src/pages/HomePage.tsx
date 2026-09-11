import { Link } from "react-router-dom";
import { useAuth } from "@auth-ninja/react";

export function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p className="muted">Checking session…</p>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="card stack">
        <h1>Auth-Ninja Vite demo</h1>
        <p className="muted">
          Throwaway UI for manual testing — not published. Use the headless hooks in your
          own app.
        </p>
        <div className="row">
          <Link to="/register">Create account</Link>
          <Link to="/login">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack">
      <h1>Signed in</h1>
      <p>
        <strong>{user.email}</strong>
      </p>
      <ul className="muted">
        <li>MFA: {user.mfaEnabled ? "enabled" : "off"}</li>
        <li>Passkeys: {user.passkeysEnabled ? "registered" : "none"}</li>
      </ul>
      <div className="row">
        <Link to="/2fa">Manage 2FA</Link>
        <Link to="/passkeys">Manage passkeys</Link>
      </div>
    </div>
  );
}
