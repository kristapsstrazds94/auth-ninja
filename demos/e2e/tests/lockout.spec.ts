import {
  AUTH_ERROR_MESSAGES,
} from "@auth-ninja/core";
import { expect, test } from "@playwright/test";
import { loginUser, registerUser } from "../helpers/auth-api.js";
import { TEST_PASSWORD, uniqueEmail } from "../helpers/constants.js";

const LOCKOUT_MAX_ATTEMPTS = 3;

test.describe("account lockout", () => {
  test("locks account after repeated failed logins via API", async ({ request }) => {
    const email = uniqueEmail("lockout-api");
    await registerUser(request, email);

    for (let attempt = 0; attempt < LOCKOUT_MAX_ATTEMPTS - 1; attempt += 1) {
      const { response, body } = await loginUser(request, email, "wrong-password-value");
      expect(response.status()).toBe(401);
      expect(body).toMatchObject({
        code: "INVALID_CREDENTIALS",
        message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    const triggering = await loginUser(request, email, "wrong-password-value");
    expect(triggering.response.status()).toBe(423);
    expect(triggering.body).toMatchObject({
      code: "ACCOUNT_LOCKED",
      message: AUTH_ERROR_MESSAGES.ACCOUNT_LOCKED,
    });

    const { response, body } = await loginUser(request, email, TEST_PASSWORD);
    expect(response.status()).toBe(423);
    expect(body).toMatchObject({
      code: "ACCOUNT_LOCKED",
      message: AUTH_ERROR_MESSAGES.ACCOUNT_LOCKED,
    });
  });

  test("shows lockout message on login page after repeated failures", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("lockout-ui");
    await registerUser(request, email);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);

    for (let attempt = 0; attempt < LOCKOUT_MAX_ATTEMPTS - 1; attempt += 1) {
      await page.getByLabel("Password").fill("wrong-password-value");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByText(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS)).toBeVisible();
    }

    await page.getByLabel("Password").fill("wrong-password-value");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(AUTH_ERROR_MESSAGES.ACCOUNT_LOCKED)).toBeVisible();

    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(AUTH_ERROR_MESSAGES.ACCOUNT_LOCKED)).toBeVisible();
  });
});
