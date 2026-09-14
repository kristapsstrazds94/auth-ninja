import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSemgrepCommand } from "./semgrep-utils.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const semgrepDir = join(repoRoot, ".semgrep");
const fixturesDir = join(semgrepDir, "fixtures");

const SUITES = [
  {
    config: "auth-ninja.yml",
    targets: [
      join(semgrepDir, "auth-ninja.ts"),
      join(fixturesDir, "packages", "session-storage.ts"),
      join(fixturesDir, "packages", "weak-hash.ts"),
      join(fixturesDir, "packages", "core", "password.ts"),
      join(fixturesDir, "packages", "react", "src", "styled-ui.tsx"),
    ],
  },
  {
    config: "auth-ninja-dotnet.yml",
    targets: [join(fixturesDir, "adapters", "PasswordHasher-fixture.cs")],
  },
];

function normalizeRuleId(checkId) {
  return checkId.replace(/^semgrep\./, "");
}

function normalizePath(filePath) {
  return relative(repoRoot, resolve(filePath)).replaceAll("\\", "/");
}

function parseExpectations(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const cases = [];

  for (let index = 0; index < lines.length; index += 1) {
    const ruleMatch = lines[index].match(/\/\/\s*ruleid:\s*(\S+)/);
    const okMatch = lines[index].match(/\/\/\s*ok:\s*(\S+)/);
    const codeLine = index + 2;

    if (ruleMatch) {
      cases.push({
        filePath,
        line: codeLine,
        ruleId: ruleMatch[1],
        shouldMatch: true,
      });
    }

    if (okMatch) {
      cases.push({
        filePath,
        line: codeLine,
        ruleId: okMatch[1],
        shouldMatch: false,
      });
    }
  }

  return cases;
}

function runSemgrep(semgrep, config, targets) {
  const configPath = join(semgrepDir, config);
  const quotedTargets = targets.map((target) => JSON.stringify(target)).join(" ");
  const command = `${semgrep} --config ${JSON.stringify(configPath)} --json --quiet ${quotedTargets}`;
  const output = execSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
  });

  const parsed = JSON.parse(output);
  const findings = [];

  for (const result of parsed.results ?? []) {
    findings.push({
      filePath: normalizePath(result.path),
      line: result.start.line,
      ruleId: normalizeRuleId(result.check_id),
    });
  }

  return findings;
}

function findingMatches(expectation, finding) {
  return (
    finding.filePath === normalizePath(expectation.filePath) &&
    finding.ruleId === expectation.ruleId &&
    Math.abs(finding.line - expectation.line) <= 1
  );
}

function main() {
  const semgrep = resolveSemgrepCommand();
  const failures = [];

  for (const suite of SUITES) {
    const expectations = suite.targets.flatMap(parseExpectations);
    const findings = runSemgrep(semgrep, suite.config, suite.targets);

    for (const expectation of expectations) {
      const matched = findings.some((finding) => findingMatches(expectation, finding));

      if (expectation.shouldMatch && !matched) {
        failures.push(
          `expected rule ${expectation.ruleId} on ${normalizePath(expectation.filePath)}:${expectation.line}`,
        );
      }

      if (!expectation.shouldMatch && matched) {
        failures.push(
          `expected no rule ${expectation.ruleId} on ${normalizePath(expectation.filePath)}:${expectation.line}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error("Semgrep rule tests failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("Semgrep rule tests passed.");
}

main();
