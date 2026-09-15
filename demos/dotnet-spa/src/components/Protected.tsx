import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RequireAuth } from "@auth-ninja/react";
import { DemoConsoleCard } from "./DemoConsoleCard";

export function Protected({ children }: { children: ReactNode }) {
  return (
    <RequireAuth
      fallback={
        <DemoConsoleCard chromeTitle="auth-ninja.demo / protected">
          <header className="demo-console-header">
            <h1>Sign in required</h1>
            <p>This page is only available to authenticated users.</p>
          </header>
          <Link to="/login" className="btn">
            Go to login
          </Link>
        </DemoConsoleCard>
      }
    >
      {children}
    </RequireAuth>
  );
}
