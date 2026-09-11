"use client";

import Link from "next/link";
import { RequireAuth } from "@auth-ninja/react";

export function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth
      fallback={
        <div className="card stack">
          <p>Sign in to access this page.</p>
          <Link href="/login">Go to login</Link>
        </div>
      }
    >
      {children}
    </RequireAuth>
  );
}
