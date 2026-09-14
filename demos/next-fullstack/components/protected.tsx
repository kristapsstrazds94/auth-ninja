"use client";

import Link from "next/link";
import { RequireAuth } from "@auth-ninja/react";
import { DemoConsoleCard } from "@/components/demo-console-card";

export function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth
      fallback={
        <DemoConsoleCard chromeTitle="auth-ninja.demo / protected">
          <header className="demo-console-header">
            <h1>Sign in required</h1>
            <p>This page is only available to authenticated users.</p>
          </header>
          <Link href="/login" className="btn">
            Go to login
          </Link>
        </DemoConsoleCard>
      }
    >
      {children}
    </RequireAuth>
  );
}
