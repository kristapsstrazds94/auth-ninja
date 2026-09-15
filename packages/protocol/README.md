# @auth-ninja/protocol

OpenAPI contract shared by `@auth-ninja/next` and `AuthNinja.AspNetCore`.

## OpenAPI spec

Import `openapi.json` for contract tests and code generation:

```ts
import openApi from "@auth-ninja/protocol/openapi.json";
```

Source of truth: [`openapi.json`](./openapi.json).

## TypeScript exports

```ts
import {
  AUTH_ENDPOINTS,
  CSRF_PROTECTED_METHODS,
  AUTH_ERROR_CODES,
  PROTOCOL_VERSION,
} from "@auth-ninja/protocol";
```

- `AUTH_ENDPOINTS` — canonical route list (must match OpenAPI paths)
- `CSRF_PROTECTED_METHODS` — state-changing routes requiring `X-CSRF-Token` when CSRF is enabled
- `AUTH_ERROR_CODES` — error codes aligned with `@auth-ninja/core`

Contract tests in `@auth-ninja/contract-tests` run the same scenarios against both Next.js and .NET adapters.
