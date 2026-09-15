import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@auth-ninja/react";
import { AuthDemoCard } from "../components/AuthDemoCard";
import { AuthPageShell } from "../components/AuthPageShell";
import { formatAuthError } from "../lib/auth-error";
import {
  type RegisterFormFieldErrors,
  validateRegisterForm,
} from "../lib/register-form-validation";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegisterFormFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateRegisterForm({ email, password, confirmPassword });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setFieldErrors({});
    setBusy(true);

    try {
      await register({ email: email.trim(), password });
      navigate("/");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell showLogo={false}>
      <AuthDemoCard
        title="Register"
        footer={
          <p className="muted auth-demo-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        }
      >
        <form className="auth-demo-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              aria-invalid={fieldErrors.email ? true : undefined}
              required
            />
            {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              required
              minLength={8}
              maxLength={128}
            />
            {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                }
              }}
              aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              required
              minLength={8}
              maxLength={128}
            />
            {fieldErrors.confirmPassword ? (
              <p className="field-error">{fieldErrors.confirmPassword}</p>
            ) : null}
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="btn-group">
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </div>
        </form>
      </AuthDemoCard>
    </AuthPageShell>
  );
}
