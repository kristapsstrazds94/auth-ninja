import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

let zxcvbnInstance: ZxcvbnFactory | undefined;

function getZxcvbn(): ZxcvbnFactory {
  if (!zxcvbnInstance) {
    zxcvbnInstance = new ZxcvbnFactory({
      translations: zxcvbnEnPackage.translations,
      graphs: zxcvbnCommonPackage.adjacencyGraphs,
      dictionary: {
        ...zxcvbnCommonPackage.dictionary,
        ...zxcvbnEnPackage.dictionary,
      },
    });
  }
  return zxcvbnInstance;
}

export type PasswordStrengthResult = {
  score: number;
  strongEnough: boolean;
};

/** Assess password strength with zxcvbn (0–4 score). */
export function assessPasswordStrength(
  password: string,
  minScore = 2,
): PasswordStrengthResult {
  const result = getZxcvbn().check(password);
  return {
    score: result.score,
    strongEnough: result.score >= minScore,
  };
}

/** True when the password meets the configured minimum zxcvbn score. */
export function isPasswordStrongEnough(password: string, minScore = 2): boolean {
  return assessPasswordStrength(password, minScore).strongEnough;
}
