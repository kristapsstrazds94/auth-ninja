import { AUTH_ERROR_MESSAGES } from "@auth-ninja/core";
import { expect, test } from "@playwright/test";
import { getSession, registerUser } from "../helpers/auth-api.js";
import { uniqueEmail } from "../helpers/constants.js";
import { browserSessionCookie, expireSessionIdle } from "../helpers/db.js";

test.describe("session expiry", () => {
  test("returns SESSION_EXPIRED for idle-expired sessions via API", async ({ request }) => {
    const email = uniqueEmail("session-idle");
    const { sessionToken } = await registerUser(request, email);

    const active = await getSession(request, sessionToken);
    expect(active.status).toBe(200);
    expect(active.body).toMatchObject({ authenticated: true });

    await expireSessionIdle(sessionToken);

    const expired = await getSession(request, sessionToken);
    expect(expired.status).toBe(401);
    expect(expired.body).toMatchObject({
      code: "SESSION_EXPIRED",
      message: AUTH_ERROR_MESSAGES.SESSION_EXPIRED,
    });
  });

  test("shows signed-out home page after idle session expiry in browser", async ({
    page,
    context,
    request,
  }) => {
    const email = uniqueEmail("session-ui");
    const { sessionToken } = await registerUser(request, email);

    await context.addCookies([browserSessionCookie(sessionToken)]);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await expireSessionIdle(sessionToken);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Auth-Ninja Next demo" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByText(email)).not.toBeVisible();
  });

  test("protected route shows sign-in prompt after session expires", async ({
    page,
    context,
    request,
  }) => {
    const email = uniqueEmail("session-protected");
    const { sessionToken } = await registerUser(request, email);

    await context.addCookies([browserSessionCookie(sessionToken)]);
    await page.goto("/2fa");
    await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();

    await expireSessionIdle(sessionToken);
    await page.reload();

    await expect(page.getByText("Sign in to access this page.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to login" })).toBeVisible();
  });
});
