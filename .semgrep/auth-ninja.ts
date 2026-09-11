// Semgrep rule tests for auth-ninja.yml (rules without path includes)

function authSecretLogging() {
  // ruleid: auth-secret-logging
  console.log("user password is " + password);

  // ruleid: auth-secret-logging
  console.debug(`session id: ${sessionId}`);

  // ok: auth-secret-logging
  console.log("login failed");
}

function hardcodedAuthSecret() {
  // ruleid: hardcoded-auth-secret
  AUTH_NINJA_SECRET = "super-secret-value-min-32-chars!!";

  // ruleid: hardcoded-auth-secret
  const env = { AUTH_NINJA_SECRET: "super-secret-value-min-32-chars!!" };

  // ok: hardcoded-auth-secret
  AUTH_NINJA_SECRET = process.env.AUTH_NINJA_SECRET;

  // ok: hardcoded-auth-secret
  const demo = { AUTH_NINJA_SECRET: DEMO_SECRET };
}
