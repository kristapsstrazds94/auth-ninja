import { detectStack, type AuthStack } from "../detect-stack.js";
import { scaffoldEnv } from "../scaffold-env.js";
import { wireDotnet } from "../wire-dotnet.js";
import { wireNext } from "../wire-next.js";
import { wireVite } from "../wire-vite.js";

export type InitOptions = {
  cwd?: string;
  /** Override auto-detected stack. */
  stack?: AuthStack;
  /** When true, print actions without writing files. */
  dryRun?: boolean;
};

export type InitResult = {
  stack: AuthStack;
  detected: Awaited<ReturnType<typeof detectStack>>;
  env: Awaited<ReturnType<typeof scaffoldEnv>> | null;
  next: Awaited<ReturnType<typeof wireNext>> | null;
  vite: Awaited<ReturnType<typeof wireVite>> | null;
  dotnet: Awaited<ReturnType<typeof wireDotnet>> | null;
};

function log(message: string): void {
  console.log(message);
}

/** Scaffold env files and wire Auth-Ninja for the detected stack. */
export async function runInit(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const detected = await detectStack(cwd);
  const stack = options.stack ?? detected.stack;

  log(`Detected stack: ${stack}`);

  if (options.dryRun) {
    log("Dry run — no files written.");
    return {
      stack,
      detected,
      env: null,
      next: null,
      vite: null,
      dotnet: null,
    };
  }

  const includeViteClient = stack === "vite" || detected.hasVite;
  const env = await scaffoldEnv({ cwd, includeViteClient });

  if (env.envCreated) {
    log("Created .env — set AUTH_NINJA_SECRET with: auth-ninja keys generate");
  } else {
    log("Skipped .env (already exists)");
  }

  if (env.envExampleCreated) {
    log("Created .env.example");
  }

  if (env.viteLinesAppended) {
    log("Appended VITE_AUTH_* client variables to .env");
  }

  let next: InitResult["next"] = null;
  let vite: InitResult["vite"] = null;
  let dotnet: InitResult["dotnet"] = null;

  switch (stack) {
    case "next": {
      next = await wireNext({ cwd });
      log(`Next.js: created ${next.filesCreated.length} file(s)`);
      if (next.middlewareSnippetCreated) {
        log("Existing middleware.ts — wrote middleware.auth-ninja-snippet.ts to merge manually");
      }
      if (next.dependenciesAdded.length > 0) {
        log(`Added dependencies: ${next.dependenciesAdded.join(", ")}`);
      }
      if (detected.hasVite) {
        vite = await wireVite({ cwd });
        log("Also wrote Vite client snippets (Vite detected alongside Next.js)");
      }
      break;
    }
    case "vite": {
      vite = await wireVite({ cwd });
      log(`Vite: created ${vite.filesCreated.length} snippet file(s)`);
      if (vite.dependenciesAdded.length > 0) {
        log(`Added dependencies: ${vite.dependenciesAdded.join(", ")}`);
      }
      break;
    }
    case "dotnet": {
      dotnet = await wireDotnet({ cwd });
      log(`Created ${dotnet.filesCreated.length} .NET snippet file(s)`);
      log("Add AuthNinja.AspNetCore NuGet package and merge auth-ninja.program.snippet.cs");
      break;
    }
    default: {
      log("Unknown stack — created env files only.");
      log("Re-run after adding next, vite, or an ASP.NET Core project, or pass --stack.");
      break;
    }
  }

  log("Next: configure AUTH_NINJA_DATABASE_URL, run migrations, then auth-ninja doctor");

  return { stack, detected, env, next, vite, dotnet };
}
