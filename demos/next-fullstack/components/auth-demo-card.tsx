import { DemoConsoleCard } from "@/components/demo-console-card";
import { DemoLogo } from "@/components/demo-logo";

type AuthDemoCardProps = {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
