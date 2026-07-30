/**
 * GPAC Value Formatter
 * Utility functions for formatting GPAC values (filter args, PID properties)
 */

import type { GPACTypes } from './gpac_args';

/**
 * Format a GPAC value for display based on its type
 * Supports all GPACTypes
 */
export function formatGpacValue(
  value: unknown,
  type: keyof GPACTypes | string,
): string {
  if (value === null || value === undefined) return 'N/A';

  switch (type) {
    // Boolean
    case 'bool':
    case 'boolean':
      return value ? 'true' : 'false';

    // Fractions: {n: numerator, d: denominator}
    case 'frac':
    case 'lfrac':
    case 'fraction':
      if (typeof value === 'object' && 'n' in value && 'd' in value) {
        return `${value.n}/${value.d}`;
      }
      return String(value);

    // Integers
    case 'sint':
    case 'uint':
    case 'lsint':
    case 'luint':
      return String(value);

    // Floats
    case 'flt':
    case 'dbl':
    case 'double':
    case 'float':
      if (typeof value === 'number') {
        return value.toFixed(3).replace(/\.?0+$/, '');
      }
      return String(value);

    // Strings
    case 'str':
    case 'cstr':
    case 'string':
    case 'name':
      return String(value);

    // FourCC codes
    case '4cc':
      return String(value);

    // Media formats
    case 'pfmt':
    case 'pixfmt':
    case 'afmt':
    case 'audiofmt':
    case 'pcmfmt':
      return String(value);

    // Color properties
    case 'cprm':
    case 'cicp_colr_prim':
    case 'ctfc':
    case 'cicp_colr_transfer':
    case 'cmxc':
    case 'cicp_colr_matrix':
      return String(value);

    // Vectors/Arrays
    case 'v2di':
    case 'v2d':
    case 'v3di':
    case 'v4di':
    case 'v2il':
      if (Array.isArray(value)) {
        return `[${value.join(', ')}]`;
      }
      return JSON.stringify(value);

    // String/Int lists
    case 'strl':
    case '4ccl':
    case 'uintl':
    case 'sintl':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return JSON.stringify(value);

    // Memory/Pointer (show as hex or size)
    case 'mem':
    case 'cmem':
      // ArrayBuffer
      if (value instanceof ArrayBuffer) {
        return `${value.byteLength} bytes`;
      }
      // Object with byteLength or length
      if (typeof value === 'object' && value !== null) {
        if ('byteLength' in value) {
          return `${value.byteLength} bytes`;
        }
        if ('length' in value) {
          return `${value.length} bytes`;
        }
        // Show hex preview for small arrays
        if (Array.isArray(value) && value.length <= 16) {
          return `[${value.map((b) => (typeof b === 'number' ? b.toString(16).padStart(2, '0') : '??')).join(' ')}]`;
        }
        return '<binary data>';
      }
      return String(value);

    case 'ptr':
      if (typeof value === 'number') {
        return `0x${value.toString(16).toUpperCase()}`;
      }
      return String(value);

    // Default: stringify
    default:
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
  }
}
