import { parseMajorToMinorUnits } from './currency';

export interface CalculatorEvaluationResult {
  isValid: boolean;
  amountMinor: string;
  displayMajor: string;
}

/**
 * Evaluates an inline calculator expression containing numbers and +, -, *, ×, /, ÷
 * with standard operator precedence, tolerating trailing operators during live typing.
 */
export function evaluateCalculatorExpression(
  expression: string,
  decimalPlaces: number
): CalculatorEvaluationResult {
  const normalized = expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '')
    .trim();

  if (!normalized) {
    return { isValid: true, amountMinor: '0', displayMajor: '0' };
  }

  // Strip trailing operators so live typing like '12.50 +' still evaluates to 12.50
  const cleaned = normalized.replace(/[+\-*/.\s]+$/, '');
  if (!cleaned) {
    return { isValid: true, amountMinor: '0', displayMajor: '0' };
  }

  // Tokenize numbers and operators (+, -, *, /)
  const tokenRegex = /(\d+\.?\d*|\.\d+|[+\-*/])/g;
  const tokens = cleaned.match(tokenRegex);
  if (!tokens || tokens.length === 0) {
    return { isValid: false, amountMinor: '0', displayMajor: '0' };
  }

  // Handle leading negative sign
  const processedTokens: (number | string)[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (
      (t === '-' || t === '+') &&
      (i === 0 || typeof processedTokens[processedTokens.length - 1] === 'string')
    ) {
      const next = tokens[i + 1];
      if (next !== undefined && !['+', '-', '*', '/'].includes(next)) {
        processedTokens.push(Number(t + next));
        i += 2;
        continue;
      }
    }
    if (['+', '-', '*', '/'].includes(t)) {
      processedTokens.push(t);
    } else {
      const num = Number(t);
      if (!Number.isFinite(num)) {
        return { isValid: false, amountMinor: '0', displayMajor: '0' };
      }
      processedTokens.push(num);
    }
    i++;
  }

  // First pass: * and /
  const pass1: (number | string)[] = [];
  let idx = 0;
  while (idx < processedTokens.length) {
    const item = processedTokens[idx];
    if (item === '*' || item === '/') {
      const left = Number(pass1.pop() ?? 0);
      const right = Number(processedTokens[idx + 1] ?? 1);
      if (item === '/' && right === 0) {
        return { isValid: false, amountMinor: '0', displayMajor: '0' };
      }
      pass1.push(item === '*' ? left * right : left / right);
      idx += 2;
    } else {
      pass1.push(item);
      idx++;
    }
  }

  // Second pass: + and -
  let total = Number(pass1[0] ?? 0);
  let j = 1;
  while (j < pass1.length) {
    const op = pass1[j];
    const right = Number(pass1[j + 1] ?? 0);
    if (op === '+') {
      total += right;
    } else if (op === '-') {
      total -= right;
    }
    j += 2;
  }

  if (!Number.isFinite(total)) {
    return { isValid: false, amountMinor: '0', displayMajor: '0' };
  }

  const clampedTotal = Math.max(0, total);
  const amountMinor = parseMajorToMinorUnits(clampedTotal, decimalPlaces);
  const factor = Math.pow(10, decimalPlaces);
  const exactMajor = Number(amountMinor) / factor;
  const displayMajor =
    decimalPlaces <= 2
      ? exactMajor.toFixed(decimalPlaces)
      : exactMajor.toFixed(decimalPlaces).replace(/0+$/, '').replace(/\.$/, '');

  return {
    isValid: true,
    amountMinor,
    displayMajor,
  };
}
