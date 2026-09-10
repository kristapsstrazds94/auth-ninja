import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const DOTNET_SETUP_SNIPPET = `// Auth-Ninja — merge into Program.cs
using AuthNinja.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthNinja(options =>
    options.BindConfiguration(builder.Configuration));

var app = builder.Build();

app.UseAuthNinja();
app.MapAuthNinja();

app.Run();
`;

export type WireDotnetOptions = {
  cwd?: string;
};

export type WireDotnetResult = {
  filesCreated: string[];
  filesSkipped: string[];
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

  await writeFile(fullPath, content, "utf8");
  return "created";
}

/** Write .NET integration snippet for AddAuthNinja / MapAuthNinja. */
export async function wireDotnet(options: WireDotnetOptions = {}): Promise<WireDotnetResult> {
  const cwd = options.cwd ?? process.cwd();
  const filesCreated: string[] = [];
  const filesSkipped: string[] = [];

  const result = await writeIfMissing(cwd, "auth-ninja.program.snippet.cs", DOTNET_SETUP_SNIPPET);
  if (result === "created") {
    filesCreated.push("auth-ninja.program.snippet.cs");
  } else {
    filesSkipped.push("auth-ninja.program.snippet.cs");
  }

  return { filesCreated, filesSkipped };
}
