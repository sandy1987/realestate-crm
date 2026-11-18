/**
 * Real Estate CRM formatting utilities.
 */

/**
 * Format currency to Indian Rupee (INR) or localized standard.
 * Gracefully preserves descriptive text rates like "45 Lakh" or "Negotiable".
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = 'INR'): string {
  if (amount === undefined || amount === null || amount === '') return '—';
  if (typeof amount === 'string') {
    const num = Number(amount);
    if (isNaN(num)) {
      return amount;
    }
    amount = num;
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}

/**
 * Format area with unit matching backend PLOT_SIZE_UNITS
 * ('sqft', 'sqyd', 'sqm', 'marla', 'kanal', 'acre', 'gaj')
 */
export function formatArea(size: number, unit: string = 'sqyd'): string {
  const unitLabels: Record<string, string> = {
    sqyd: 'Sq. Yds',
    sqft: 'Sq. Ft',
    sqm: 'Sq. Mtrs',
    acres: 'Acres',
    acre: 'Acres',
    hectares: 'Hectares',
    bigha: 'Bigha',
    gaj: 'Gaj',
    marla: 'Marla',
    kanal: 'Kanal',
  };
  return `${size.toLocaleString('en-IN')} ${unitLabels[unit] || unit}`;
}

/**
 * Format plot rate distinguishing total rate vs rate-per-unit.
 * Preserves custom price strings like "Negotiable", "Call for Price", or "45 Lakh".
 */
export function formatPlotRate(
  rate: number | string | null | undefined,
  rateType: 'total' | 'per_unit' = 'total',
  sizeUnit: string = 'sqyd',
  currency: string = 'INR'
): string {
  if (rate === undefined || rate === null || rate === '') return '—';
  if (typeof rate === 'string' && isNaN(Number(rate))) {
    return rate;
  }
  const formattedAmount = formatCurrency(rate, currency);
  if (rateType === 'per_unit') {
    const unitLabels: Record<string, string> = {
      sqyd: 'sq.yd',
      sqft: 'sq.ft',
      sqm: 'sq.m',
      acres: 'acre',
      acre: 'acre',
      gaj: 'gaj',
      marla: 'marla',
      kanal: 'kanal',
    };
    const unitLabel = unitLabels[sizeUnit] || sizeUnit;
    return `${formattedAmount} / ${unitLabel}`;
  }
  return `${formattedAmount} Total`;
}

/**
 * Format ISO date string into human-readable format.
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Format date with time.
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(dateString);
  }
}
