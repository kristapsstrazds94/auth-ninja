type DemoConsoleChromeProps = {
  title: string;
  showStatus?: boolean;
};

export function DemoConsoleChrome({
  title,
  showStatus = true,
}: DemoConsoleChromeProps) {
  return (
    <div className="demo-console-chrome" aria-hidden="true">
      <span className="demo-console-chrome-dots">
        <span />
        <span />
        <span />
      </span>
      <span className="demo-console-chrome-title">{title}</span>
      {showStatus ? (
        <span className="demo-console-status">
          <span className="demo-console-status-dot" />
          secure
        </span>
      ) : null}
    </div>
  );
}
