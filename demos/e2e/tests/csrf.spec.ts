import { expect, test } from "@playwright/test";
import {
  fetchCsrfToken,
  postWithoutCsrf,
  registerUser,
} from "../helpers/auth-api.js";
import { TEST_PASSWORD, uniqueEmail } from "../helpers/constants.js";

test.describe("CSRF protection", () => {
  test("rejects state-changing auth requests without CSRF token", async ({ request }) => {
    const email = uniqueEmail("csrf-blocked");

    const blocked = await postWithoutCsrf(request, "/auth/register", {
      email,
      password: TEST_PASSWORD,
    });

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("CSRF_INVALID");
  });

  test("allows register when a valid CSRF token is supplied", async ({ request }) => {
    const email = uniqueEmail("csrf-ok");
    const result = await registerUser(request, email);

    expect(result.sessionToken.length).toBeGreaterThan(20);
    expect(result.email).toBe(email);
  });

  test("rejects login without CSRF even with valid credentials", async ({ request }) => {
    const email = uniqueEmail("csrf-login");
    await registerUser(request, email);

    const blocked = await postWithoutCsrf(request, "/auth/login", {
      email,
      password: TEST_PASSWORD,
    });

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("CSRF_INVALID");
  });

  test("issues fresh CSRF tokens from /auth/csrf", async ({ request }) => {
    const first = await fetchCsrfToken(request);
    const second = await fetchCsrfToken(request);

    expect(first.length).toBeGreaterThan(20);
    expect(second.length).toBeGreaterThan(20);
    expect(first).not.toBe(second);
  });
});
