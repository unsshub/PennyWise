export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  defaultRateToUsd: number;
}

export const SUPPORTED_CURRENCIES: CurrencyDefinition[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, defaultRateToUsd: 1.0 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, defaultRateToUsd: 1.08 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, defaultRateToUsd: 1.27 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimalPlaces: 2, defaultRateToUsd: 0.72 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2, defaultRateToUsd: 0.66 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0, defaultRateToUsd: 0.0067 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2, defaultRateToUsd: 1.13 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', decimalPlaces: 2, defaultRateToUsd: 0.10 },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimalPlaces: 8, defaultRateToUsd: 90000.0 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimalPlaces: 6, defaultRateToUsd: 3200.0 },
];

export function getCurrencyDefinition(code: string): CurrencyDefinition {
  const upper = code.toUpperCase();
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  return (
    found ?? {
      code: upper,
      name: upper,
      symbol: upper,
      decimalPlaces: 2,
      defaultRateToUsd: 1.0,
    }
  );
}

/**
 * Converts an amount in minor units from a currency with `fromDecimals`
 * to a target currency with `toDecimals` using `rateToTarget` (1 unit of from = rateToTarget units of target).
 * Uses exact BigInt scaling for high precision across 2-decimal fiat and 8-decimal crypto (per ADR-0003).
 */
export function convertMinorUnits(
  amountMinor: string | bigint,
  fromDecimals: number,
  toDecimals: number,
  rateToTarget: number
): string {
  const rawBig = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor || '0');
  if (rawBig === 0n) {
    return '0';
  }
  if (fromDecimals === toDecimals && rateToTarget === 1) {
    return rawBig.toString();
  }

  const RATE_SCALE = 1_000_000_000_000n;
  const scaledRate = BigInt(Math.round(rateToTarget * 1_000_000_000_000));
  const fromFactor = 10n ** BigInt(fromDecimals);
  const toFactor = 10n ** BigInt(toDecimals);

  const numerator = rawBig * scaledRate * toFactor;
  const denominator = fromFactor * RATE_SCALE;

  const isNegative = numerator < 0n;
  const absNum = isNegative ? -numerator : numerator;
  const roundedAbs = (absNum + denominator / 2n) / denominator;
  const result = isNegative ? -roundedAbs : roundedAbs;
  return result.toString();
}

export function formatMinorUnits(
  amountMinor: string | bigint,
  currencyCode: string,
  decimalPlaces?: number,
  options?: { privacyMasked?: boolean; showPlusSign?: boolean }
): string {
  const def = getCurrencyDefinition(currencyCode);
  if (options?.privacyMasked) {
    return `${def.symbol}••••`;
  }
  const decimals = decimalPlaces ?? def.decimalPlaces;
  const big = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor || '0');
  const isNegative = big < 0n;
  const absBig = isNegative ? -big : big;

  const divisor = 10n ** BigInt(decimals);
  const wholePart = absBig / divisor;
  const fracPart = absBig % divisor;

  const formattedWhole = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let formattedFrac = '';
  if (decimals > 0) {
    const rawFrac = fracPart.toString().padStart(decimals, '0');
    if (decimals > 2) {
      const trimmed = rawFrac.replace(/0+$/, '');
      const minDecimals = Math.min(decimals, 4);
      formattedFrac = '.' + (trimmed.length < minDecimals ? rawFrac.slice(0, minDecimals) : trimmed);
    } else {
      formattedFrac = '.' + rawFrac;
    }
  }

  const sign = isNegative ? '-' : options?.showPlusSign && big > 0n ? '+' : '';
  const space = def.symbol.length > 2 ? ' ' : '';
  return `${sign}${def.symbol}${space}${formattedWhole}${formattedFrac}`;
}

/**
 * Pure string-based decimal parser into exact BigInt minor units without IEEE-754 float multiplication (ADR-0003).
 */
export function parseMajorToMinorUnits(majorInput: string | number, decimalPlaces: number): string {
  const cleaned = String(majorInput).replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '+' || cleaned === '.') {
    return '0';
  }

  // Handle scientific notation if a number like 1e-7 was passed
  let normalizedStr = cleaned;
  if (/e/i.test(normalizedStr)) {
    const num = Number(normalizedStr);
    if (!Number.isFinite(num)) {
      return '0';
    }
    normalizedStr = num.toFixed(Math.max(decimalPlaces + 2, 10));
  }

  const isNegative = normalizedStr.startsWith('-');
  const unsigned = normalizedStr.replace(/^[+-]/, '');
  const parts = unsigned.split('.');
  if (parts.length > 2) {
    return '0';
  }

  const wholeStr = (parts[0] || '0').replace(/\D/g, '') || '0';
  const rawFracStr = (parts[1] || '').replace(/\D/g, '');

  const paddedFrac = rawFracStr.padEnd(decimalPlaces + 1, '0');
  const activeFrac = decimalPlaces > 0 ? paddedFrac.slice(0, decimalPlaces) : '';
  const roundingDigit = Number(paddedFrac[decimalPlaces] ?? '0');

  const baseMinor =
    BigInt(wholeStr) * 10n ** BigInt(decimalPlaces) +
    (activeFrac ? BigInt(activeFrac) : 0n);

  const roundedMinor = roundingDigit >= 5 ? baseMinor + 1n : baseMinor;
  const signedMinor = isNegative ? -roundedMinor : roundedMinor;
  return signedMinor.toString();
}
