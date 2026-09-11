import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { RequireAuth, useAuth } from "@auth-ninja/react";

function NavLinks() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return <span className="muted">Loading session…</span>;
  }

  if (isAuthenticated) {
    return (
      <>
        <Link to="/">Home</Link>
        <Link to="/2fa">2FA</Link>
        <Link to="/passkeys">Passkeys</Link>
        <button type="button" className="secondary" onClick={() => void logout()}>
          Log out
        </button>
      </>
    );
  }

  return (
    <>
      <Link to="/login">Log in</Link>
      <Link to="/register">Register</Link>
      <Link to="/passkeys">Passkeys</Link>
    </>
  );
}

export function Layout() {
  return (
    <>
      <nav>
        <strong>Auth-Ninja</strong>
        <NavLinks />
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

export function Protected({ children }: { children: ReactNode }) {
  return (
    <RequireAuth
      fallback={
        <div className="card stack">
          <p>Sign in to access this page.</p>
          <Link to="/login">Go to login</Link>
        </div>
      }
    >
      {children}
    </RequireAuth>
  );
}
