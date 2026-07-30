/**
 * Convert argument value to GPAC-compatible string format
 * GPAC parses all arguments as strings internally, so we normalize
 * values to their string representation according to type
 */
export function convertArgumentValue(
  value: unknown,
  type: string,
): string | null {
  if (value === null || value === undefined) return null;

  // Handle specific types - convert to string format expected by GPAC
  switch (type) {
    case 'bool':
      // GPAC expects "true"/"false" or "1"/"0"
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        return lower === 'true' || lower === '1' ? 'true' : 'false';
      }
      return value ? 'true' : 'false';

    case 'uint':
    case 'sint':
    case 'luint':
    case 'lsint': {
      const parsed = parseInt(String(value), 10);
      if (isNaN(parsed)) {
        console.warn(`Invalid integer value: ${value}, using 0`);
        return '0';
      }
      return String(parsed);
    }

    case 'flt':
    case 'dbl': {
      const parsed = parseFloat(String(value));
      if (isNaN(parsed)) {
        console.warn(`Invalid float value: ${value}, using 0.0`);
        return '0.0';
      }
      return String(parsed);
    }

    case 'frac':
    case 'lfrac':
      // Ensure consistent fraction format (num/den)
      if (typeof value === 'string' && value.includes('/')) {
        return value.trim();
      } else if (
        typeof value === 'object' &&
        'num' in value &&
        'den' in value
      ) {
        return `${value.num}/${value.den}`;
      } else {
        return `${value}/1`; // Default denominator
      }

    // For list types, ensure they're properly formatted as comma-separated
    case 'strl':
    case 'uintl':
    case 'sintl':
    case '4ccl':
      if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).join(',');
      }
      return String(value).trim();

    default:
      return String(value).trim();
  }
}
