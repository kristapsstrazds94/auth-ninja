import type { WebAuthnCredentialResponseJson } from "@auth-ninja/react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

export async function performPasskeyRegistration(
  options: Record<string, unknown>,
): Promise<WebAuthnCredentialResponseJson> {
  const response = await startRegistration({
    optionsJSON: options as unknown as Parameters<
      typeof startRegistration
    >[0]["optionsJSON"],
  });
  return response as unknown as WebAuthnCredentialResponseJson;
}

export async function performPasskeyAuthentication(
  options: Record<string, unknown>,
): Promise<WebAuthnCredentialResponseJson> {
  const response = await startAuthentication({
    optionsJSON: options as unknown as Parameters<
      typeof startAuthentication
    >[0]["optionsJSON"],
  });
  return response as unknown as WebAuthnCredentialResponseJson;
}