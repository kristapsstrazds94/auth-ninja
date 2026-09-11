type SpinnerProps = {
  label?: string;
  size?: "sm" | "md";
  centered?: boolean;
};

export function Spinner({ label, size = "md", centered = false }: SpinnerProps) {
  return (
    <div
      className={`spinner-wrap${size === "sm" ? " spinner-wrap-sm" : ""}${centered ? " spinner-wrap-centered" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="spinner-label">{label}</span> : null}
      <span className="visually-hidden">{label ?? "Loading"}</span>
    </div>
  );
}
