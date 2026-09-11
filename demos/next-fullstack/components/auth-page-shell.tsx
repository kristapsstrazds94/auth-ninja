import { DemoLogo } from "@/components/demo-logo";

type AuthPageShellProps = {
  children: React.ReactNode;
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
