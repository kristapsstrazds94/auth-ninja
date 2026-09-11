"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@auth-ninja/react";

const PACKAGE_NAME = "@auth-ninja/react";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link href={href} className={`demo-nav-link${isActive ? " is-active" : ""}`}>
      {children}
    </Link>
  );
}

export function DemoNav() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="demo-nav">
      <Link href="/" className="demo-nav-brand">
        {PACKAGE_NAME}
      </Link>

      <div className="demo-nav-links">
        {isAuthenticated ? (
          <>
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/2fa">2FA</NavLink>
            <NavLink href="/passkeys">Passkeys</NavLink>
            <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink href="/login">Log in</NavLink>
            <NavLink href="/register">Register</NavLink>
            <NavLink href="/passkeys">Passkeys</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
