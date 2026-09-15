import type { ReactNode } from "react";
import { DemoConsoleCard } from "./DemoConsoleCard";
import { DemoLogo } from "./DemoLogo";

type AuthDemoCardProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthDemoCard({ title, children, footer }: AuthDemoCardProps) {
  return (
    <DemoConsoleCard className="auth-demo-card">
      <div className="auth-card-header">
        <div className="auth-card-logo">
          <DemoLogo variant="hero" tone="dark" />
        </div>
        <h1 className="auth-card-title">{title}</h1>
      </div>

      {children}

      {footer}

      <ul className="auth-demo-shields" aria-label="Security features demonstrated">
        <li>HttpOnly session</li>
        <li>Argon2id</li>
        <li>CSRF</li>
      </ul>
    </DemoConsoleCard>
  );
}
