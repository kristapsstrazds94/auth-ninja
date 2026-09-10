import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContractScenario } from "./types.js";

export type {
  ContractDispatchFn,
  ContractDispatchInit,
  ContractExpect,
  ContractRunnerOptions,
  ContractScenario,
  ContractStep,
} from "./types.js";
export { loadScenarios, runContractScenario } from "./runner.js";

const scenariosDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scenarios",
);

function loadScenarioFile(fileName: string): ContractScenario {
  const raw = readFileSync(path.join(scenariosDir, fileName), "utf8");
  return JSON.parse(raw) as ContractScenario;
}

/** All shared scenarios executed by Next and .NET contract test suites. */
export const SHARED_CONTRACT_SCENARIOS: ContractScenario[] = readdirSync(scenariosDir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => loadScenarioFile(name));
