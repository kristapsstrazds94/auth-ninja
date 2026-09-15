import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FullStack } from "./detect-stack.js";
import { detectPackageManager, type PackageManager } from "./detect-package-manager.js";
import { findCsprojPath } from "./find-csproj.js";
import { findFrontendDir } from "./find-frontend-dir.js";
import { runCommand } from "./run-command.js";

export type InstallPackagesOptions = {
  cwd?: string;
  stack: FullStack;
  packageManager?: PackageManager;
};

export type InstallPackagesResult = {
  packageManager: PackageManager;
  commands: string[];
  warnings: string[];
};

function addArgs(pm: PackageManager, packages: string[]): string[] {
  switch (pm) {
    case "pnpm":
      return ["add", ...packages];
    case "yarn":
      return ["add", ...packages];
    case "bun":
      return ["add", ...packages];
    default:
      return ["install", "--save", ...packages];
  }
}

async function installNpmPackages(
  cwd: string,
  pm: PackageManager,
  packages: string[],
): Promise<void> {
  const result = await runCommand(pm, addArgs(pm, packages), { cwd });
  if (!result.ok) {
    throw new Error(
      `Failed to install ${packages.join(", ")}.\n${result.stderr || result.stdout}`.trim(),
    );
  }
}

/** Install npm and NuGet packages for the selected full-stack. */
export async function installPackages(
  options: InstallPackagesOptions,
): Promise<InstallPackagesResult> {
  const cwd = options.cwd ?? process.cwd();
  const pm = options.packageManager ?? detectPackageManager(cwd);
  const commands: string[] = [];
  const warnings: string[] = [];

  if (options.stack === "next") {
    if (!existsSync(join(cwd, "package.json"))) {
      throw new Error("No package.json found — run setup from your Next.js project root.");
    }

    const args = addArgs(pm, ["@auth-ninja/core", "@auth-ninja/next", "@auth-ninja/react"]);
    commands.push(`${pm} ${args.join(" ")}`);
    await installNpmPackages(cwd, pm, ["@auth-ninja/core", "@auth-ninja/next", "@auth-ninja/react"]);
    return { packageManager: pm, commands, warnings };
  }

  const csproj = findCsprojPath(cwd);
  if (!csproj) {
    throw new Error(
      "No .csproj found — run setup from your ASP.NET Core API folder or repo root.",
    );
  }

  const dotnetAdd = await runCommand("dotnet", ["add", csproj, "package", "AuthNinja.AspNetCore"], {
    cwd,
  });
  commands.push(`dotnet add ${csproj} package AuthNinja.AspNetCore`);
  if (!dotnetAdd.ok) {
    throw new Error(
      `Failed to add AuthNinja.AspNetCore.\n${dotnetAdd.stderr || dotnetAdd.stdout}`.trim(),
    );
  }

  const frontendDir = await findFrontendDir(cwd);
  if (frontendDir) {
    const frontendPath = frontendDir === "." ? cwd : join(cwd, frontendDir);
    const frontendPm = detectPackageManager(frontendPath);
    const args = addArgs(frontendPm, ["@auth-ninja/react"]);
    commands.push(`cd ${frontendDir} && ${frontendPm} ${args.join(" ")}`);
    await installNpmPackages(frontendPath, frontendPm, ["@auth-ninja/react"]);
  } else {
    warnings.push(
      "No React frontend detected — install @auth-ninja/react in your SPA when you add the client.",
    );
  }

  return { packageManager: pm, commands, warnings };
}
