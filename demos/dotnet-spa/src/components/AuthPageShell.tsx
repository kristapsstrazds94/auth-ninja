import type { ReactNode } from "react";
import { DemoLogo } from "./DemoLogo";

type AuthPageShellProps = {
  children: ReactNode;
  showLogo?: boolean;
};

export function AuthPageShell({ children, showLogo = true }: AuthPageShellProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout-inner stack">
        {showLogo ? <DemoLogo variant="hero" /> : null}
        {children}
      </div>
    </div>
  );
}
