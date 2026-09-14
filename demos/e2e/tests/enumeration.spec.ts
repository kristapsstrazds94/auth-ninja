import {
  AUTH_ERROR_MESSAGES,
  AUTH_GENERIC_MESSAGES,
} from "@auth-ninja/core";
import { expect, test } from "@playwright/test";
import { loginUser, registerUser } from "../helpers/auth-api.js";
import {
  FORBIDDEN_MESSAGE_FRAGMENTS,
  TEST_PASSWORD,
  uniqueEmail,
} from "../helpers/constants.js";

function assertNoEnumerationLeaks(message: string): void {
  const lower = message.toLowerCase();
  for (const fragment of FORBIDDEN_MESSAGE_FRAGMENTS) {
    expect(lower, `message must not contain "${fragment}"`).not.toContain(fragment);
  }
}

test.describe("user enumeration resistance", () => {
  test("returns the same message for unknown email and wrong password", async ({ request }) => {
    const email = uniqueEmail("enum-known");
    await registerUser(request, email);

    const unknown = await loginUser(request, uniqueEmail("enum-unknown"), TEST_PASSWORD);
    const wrongPassword = await loginUser(request, email, "wrong-password-value");

    expect(unknown.response.status()).toBe(401);
    expect(wrongPassword.response.status()).toBe(401);

    expect(unknown.body).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
    });
    expect(wrongPassword.body).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
    });
    expect(unknown.body).toEqual(wrongPassword.body);
  });

  test("duplicate registration returns generic failure without account hints", async ({
    request,
  }) => {
    const email = uniqueEmail("enum-dup");
    await registerUser(request, email);

    await expect(async () => registerUser(request, email)).rejects.toThrow(
      AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED,
    );
  });

  test("login and register UI errors avoid enumeration phrases", async ({ page, request }) => {
    const email = uniqueEmail("enum-ui");
    await registerUser(request, email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("enum-ui-unknown"));
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const loginError = await page.locator(".error").textContent();
    expect(loginError).toBe(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    assertNoEnumerationLeaks(loginError ?? "");

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    const registerError = await page.locator(".error").textContent();
    expect(registerError).toBe(AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED);
    assertNoEnumerationLeaks(registerError ?? "");
  });
});
