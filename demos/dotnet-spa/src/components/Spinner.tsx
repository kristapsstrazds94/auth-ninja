type SpinnerProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  centered?: boolean;
};

export function Spinner({ label, size = "md", centered = false }: SpinnerProps) {
  const sizeClass =
    size === "sm" ? " spinner-wrap-sm" : size === "lg" ? " spinner-wrap-lg" : "";

  return (
    <div
      className={`spinner-wrap${sizeClass}${centered ? " spinner-wrap-centered" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="spinner-label">{label}</span> : null}
      <span className="visually-hidden">{label ?? "Loading"}</span>
    </div>
  );
}
