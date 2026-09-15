import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@auth-ninja/react";

const PACKAGE_NAME = "@auth-ninja/react";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== "/" && pathname.startsWith(to));

  return (
    <Link to={to} className={`demo-nav-link${isActive ? " is-active" : ""}`}>
      {children}
    </Link>
  );
}

export function DemoNav() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="demo-nav">
      <div className="demo-nav-chrome">
        <span className="demo-console-chrome-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>

        <Link to="/" className="demo-nav-brand">
          {PACKAGE_NAME}
        </Link>

        <div className="demo-nav-links">
          {isAuthenticated ? (
            <>
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/2fa">2FA</NavLink>
              <NavLink to="/passkeys">Passkeys</NavLink>
              <button type="button" className="btn btn-secondary btn-nav" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
