import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { authLibImport, resolveProjectLayout } from "./project-layout.js";

type RouteSpec = {
  segments: string[];
  method: string;
  factory: string;
  /** When set, export a handler that unwraps async Next.js params. */
  dynamicParam?: string;
};

const ROUTES: RouteSpec[] = [
  { segments: ["auth", "register"], method: "POST", factory: "createRegisterHandler" },
  { segments: ["auth", "login"], method: "POST", factory: "createLoginHandler" },
  { segments: ["auth", "logout"], method: "POST", factory: "createLogoutHandler" },
  { segments: ["auth", "session"], method: "GET", factory: "createSessionHandler" },
  { segments: ["auth", "csrf"], method: "GET", factory: "createCsrfHandler" },
  { segments: ["auth", "2fa", "enroll"], method: "POST", factory: "createTwoFaEnrollHandler" },
  { segments: ["auth", "2fa", "confirm"], method: "POST", factory: "createTwoFaConfirmHandler" },
  { segments: ["auth", "2fa", "verify"], method: "POST", factory: "createTwoFaVerifyHandler" },
  {
    segments: ["auth", "2fa", "backup-codes"],
    method: "POST",
    factory: "createTwoFaBackupCodesHandler",
  },
  { segments: ["auth", "2fa"], method: "DELETE", factory: "createTwoFaDisableHandler" },
  {
    segments: ["auth", "passkeys", "register", "begin"],
    method: "POST",
    factory: "createPasskeyRegisterBeginHandler",
  },
  {
    segments: ["auth", "passkeys", "register", "finish"],
    method: "POST",
    factory: "createPasskeyRegisterFinishHandler",
  },
  {
    segments: ["auth", "passkeys", "login", "begin"],
    method: "POST",
    factory: "createPasskeyLoginBeginHandler",
  },
  {
    segments: ["auth", "passkeys", "login", "finish"],
    method: "POST",
    factory: "createPasskeyLoginFinishHandler",
  },
  { segments: ["auth", "passkeys"], method: "GET", factory: "createPasskeyListHandler" },
  {
    segments: ["auth", "passkeys", "[credentialId]"],
    method: "DELETE",
    factory: "createPasskeyDeleteHandler",
    dynamicParam: "credentialId",
  },
];

const AUTH_LIB_TEMPLATE = `import { loadAuthNinjaConfig } from "@auth-ninja/core";
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
  type AuthNinjaContext,
} from "@auth-ninja/next";

let authPromise: Promise<AuthNinjaContext> | undefined;

/** Shared Auth-Ninja context — migrations run once per process. */
export async function getAuthNinja(): Promise<AuthNinjaContext> {
  if (!authPromise) {
    authPromise = (async () => {
      const config = loadAuthNinjaConfig();
      const { db, client } = createAuthDb(config.databaseUrl);
      await runAuthMigrations({ db, client });
      return createAuthNinjaContext({ config, db });
    })();
  }
  return authPromise;
}
`;

const MIDDLEWARE_TEMPLATE = `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "./lib/auth-ninja.js";

export async function middleware(request: NextRequest) {
  const auth = await getAuthNinja();
  const guard = createAuthMiddleware(auth);
  const blocked = await guard(request);
  if (blocked) {
    return blocked;
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/auth/:path*",
};
`;

const MIDDLEWARE_SNIPPET = `// Auth-Ninja — merge into middleware.ts
import type { NextRequest } from "next/server";
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "./lib/auth-ninja.js";

export async function authNinjaMiddleware(request: NextRequest) {
  const auth = await getAuthNinja();
  const guard = createAuthMiddleware(auth);
  return guard(request);
}

// Call authNinjaMiddleware(request) before NextResponse.next() for /auth/* paths.
`;

export type WireNextOptions = {
  cwd?: string;
};

export type WireNextResult = {
  filesCreated: string[];
  filesSkipped: string[];
  middlewareCreated: boolean;
  middlewareSnippetCreated: boolean;
  dependenciesAdded: string[];
};

async function writeIfMissing(
  cwd: string,
  relativePath: string,
  content: string,
): Promise<"created" | "skipped"> {
  const fullPath = join(cwd, relativePath);
  if (existsSync(fullPath)) {
    return "skipped";
  }

  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
  return "created";
}

function routeFileContent(spec: RouteSpec, importPath: string): string {
  const { method, factory, dynamicParam } = spec;

  if (dynamicParam) {
    return `import { ${factory} } from "@auth-ninja/next";
import { getAuthNinja } from "${importPath}";

export async function ${method}(
  request: Request,
  context: { params: Promise<{ ${dynamicParam}: string }> },
) {
  const auth = await getAuthNinja();
  const params = await context.params;
  return ${factory}(auth)(request, { params });
}
`;
  }

  return `import { ${factory} } from "@auth-ninja/next";
import { getAuthNinja } from "${importPath}";

export async function ${method}(request: Request) {
  const auth = await getAuthNinja();
  return ${factory}(auth)(request);
}
`;
}

function middlewareImportPath(cwd: string, layout: ReturnType<typeof resolveProjectLayout>): string {
  const middlewareDir = dirname(join(cwd, layout.middlewareRelative));
  const libPath = join(cwd, layout.authLibRelative);
  const rel = relative(middlewareDir, libPath).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function middlewareContent(cwd: string, layout: ReturnType<typeof resolveProjectLayout>): string {
  const importPath = middlewareImportPath(cwd, layout);
  return MIDDLEWARE_TEMPLATE.replace("./lib/auth-ninja.js", importPath);
}

async function mergeDependencies(cwd: string): Promise<string[]> {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) {
    return [];
  }

  const raw = await readFile(packagePath, "utf8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const added: string[] = [];
  const deps = (pkg.dependencies ??= {});

  for (const name of ["@auth-ninja/core", "@auth-ninja/next", "@auth-ninja/react"]) {
    if (!deps[name]) {
      deps[name] = "^0.0.0";
      added.push(name);
    }
  }

  if (added.length > 0) {
    await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  return added;
}

/** Scaffold Next.js App Router handlers, shared context, and middleware. */
export async function wireNext(options: WireNextOptions = {}): Promise<WireNextResult> {
  const cwd = options.cwd ?? process.cwd();
  const layout = resolveProjectLayout(cwd);
  const filesCreated: string[] = [];
  const filesSkipped: string[] = [];

  const libResult = await writeIfMissing(cwd, layout.authLibRelative, AUTH_LIB_TEMPLATE);
  if (libResult === "created") {
    filesCreated.push(layout.authLibRelative);
  } else {
    filesSkipped.push(layout.authLibRelative);
  }

  for (const spec of ROUTES) {
    const routeDir = join(layout.appRoot, ...spec.segments);
    const routeRelative = relative(cwd, join(routeDir, "route.ts")).replace(/\\/g, "/");
    const importPath = authLibImport(spec.segments);
    const content = routeFileContent(spec, importPath);

    const result = await writeIfMissing(cwd, routeRelative, content);
    if (result === "created") {
      filesCreated.push(routeRelative);
    } else {
      filesSkipped.push(routeRelative);
    }
  }

  let middlewareCreated = false;
  let middlewareSnippetCreated = false;

  if (!existsSync(join(cwd, layout.middlewareRelative))) {
    const result = await writeIfMissing(
      cwd,
      layout.middlewareRelative,
      middlewareContent(cwd, layout),
    );
    middlewareCreated = result === "created";
    if (middlewareCreated) {
      filesCreated.push(layout.middlewareRelative);
    }
  } else {
    const snippetPath = layout.middlewareRelative.replace(/\.ts$/, ".auth-ninja-snippet.ts");
    const result = await writeIfMissing(cwd, snippetPath, MIDDLEWARE_SNIPPET);
    middlewareSnippetCreated = result === "created";
    if (middlewareSnippetCreated) {
      filesCreated.push(snippetPath);
    } else {
      filesSkipped.push(snippetPath);
    }
  }

  const dependenciesAdded = await mergeDependencies(cwd);

  return {
    filesCreated,
    filesSkipped,
    middlewareCreated,
    middlewareSnippetCreated,
    dependenciesAdded,
  };
}
