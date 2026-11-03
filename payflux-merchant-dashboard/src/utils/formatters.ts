/**
 * Format a number into Indian Rupee (INR) representation with ₹ symbol.
 * Example: 48250 -> "₹48,250.00" or without decimals "₹48,250"
 */
export function formatINR(amount: number, includeDecimals = true): string {
  if (isNaN(amount)) return '₹0.00';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);

  const fixed = absVal.toFixed(includeDecimals ? 2 : 0);
  const [integerPart, decimalPart] = fixed.split('.');

  // Indian numbering system format (e.g. 12,34,567)
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = `₹${formattedInteger}${decimalPart !== undefined ? `.${decimalPart}` : ''}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Compact INR formatting for badges and small cards (e.g., ₹42.8K, ₹1.36L, ₹12.5Cr).
 */
export function formatCompactINR(amount: number): string {
  if (isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${sign}₹${abs.toFixed(0)}`;
}

/**
 * Format percentage with + or - symbol.
 */
export function formatPercent(value: number, includeSign = true): string {
  const sign = value > 0 && includeSign ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format ISO date string into readable date string.
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString;
  }
}
