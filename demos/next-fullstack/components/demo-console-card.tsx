import { DemoConsoleChrome } from "@/components/demo-console-chrome";

type DemoConsoleCardProps = {
  children: React.ReactNode;
  chromeTitle?: string;
  showStatus?: boolean;
  className?: string;
};

export function DemoConsoleCard({
  children,
  chromeTitle = "auth-ninja.demo",
  showStatus = true,
  className,
}: DemoConsoleCardProps) {
  const classes = ["demo-console-card", "stack", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <DemoConsoleChrome title={chromeTitle} showStatus={showStatus} />
      <div className="demo-console-body">{children}</div>
    </div>
  );
}
