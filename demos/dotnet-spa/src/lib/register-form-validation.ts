import { isPasswordStrongEnough } from "@auth-ninja/core/password-policy";

export type RegisterFormInput = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegisterFormFieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export type RegisterFormValidationResult = {
  valid: boolean;
  fieldErrors: RegisterFormFieldErrors;
};

const DEFAULT_PASSWORD_MIN_SCORE = 2;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Client-side register form validation aligned with server register rules. */
export function validateRegisterForm(
  input: RegisterFormInput,
  options?: { passwordMinScore?: number },
): RegisterFormValidationResult {
  const fieldErrors: RegisterFormFieldErrors = {};
  const passwordMinScore = options?.passwordMinScore ?? DEFAULT_PASSWORD_MIN_SCORE;

  const email = input.email.trim();
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  const password = input.password;
  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  } else if (password.length > 128) {
    fieldErrors.password = "Password must be at most 128 characters.";
  } else if (!isPasswordStrongEnough(password, passwordMinScore)) {
    fieldErrors.password = "Password does not meet strength requirements.";
  }

  const confirmPassword = input.confirmPassword;
  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Please confirm your password.";
  } else if (password && confirmPassword !== password) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}
