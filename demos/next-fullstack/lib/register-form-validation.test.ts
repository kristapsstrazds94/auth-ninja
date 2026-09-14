import { describe, expect, it } from "vitest";
import { validateRegisterForm } from "./register-form-validation";

describe("validateRegisterForm", () => {
  it("accepts valid registration input", () => {
    const result = validateRegisterForm({
      email: "new@test.local",
      password: "secure-password-1",
      confirmPassword: "secure-password-1",
    });

    expect(result.valid).toBe(true);
    expect(result.fieldErrors).toEqual({});
  });

  it("rejects mismatched passwords", () => {
    const result = validateRegisterForm({
      email: "new@test.local",
      password: "secure-password-1",
      confirmPassword: "secure-password-2",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.confirmPassword).toBe("Passwords do not match.");
  });

  it("rejects weak passwords", () => {
    const result = validateRegisterForm({
      email: "new@test.local",
      password: "password",
      confirmPassword: "password",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.password).toBe("Password does not meet strength requirements.");
  });

  it("rejects invalid email", () => {
    const result = validateRegisterForm({
      email: "not-an-email",
      password: "secure-password-1",
      confirmPassword: "secure-password-1",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.email).toBe("Enter a valid email address.");
  });
});
