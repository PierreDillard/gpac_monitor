import { describe, it, expect } from 'vitest';
import { parseSessionTimeInput } from '../sessionTimeInput';

const HOUR_US = 3_600_000_000;
const SESSION_72H_US = 72 * HOUR_US;

describe('parseSessionTimeInput', () => {
  it('parses 12:33:55 into relative microseconds', () => {
    expect(parseSessionTimeInput('12:33:55', SESSION_72H_US)).toBe(
      (12 * 3600 + 33 * 60 + 55) * 1_000_000,
    );
  });

  it('accepts hours beyond 24 on a long session', () => {
    expect(parseSessionTimeInput('71:59:00', SESSION_72H_US)).toBe(
      (71 * 3600 + 59 * 60) * 1_000_000,
    );
  });

  it('accepts MM:SS as displayed under one hour', () => {
    expect(parseSessionTimeInput('05:30', SESSION_72H_US)).toBe(330_000_000);
  });

  it('reads digits-only input from the right', () => {
    expect(parseSessionTimeInput('123355', SESSION_72H_US)).toBe(
      (12 * 3600 + 33 * 60 + 55) * 1_000_000,
    );
    expect(parseSessionTimeInput('530', SESSION_72H_US)).toBe(330_000_000);
  });

  it('rejects a time past the session end', () => {
    expect(parseSessionTimeInput('72:00:01', SESSION_72H_US)).toBeNull();
  });

  it('reads 1d 02:00:00 and 26:00:00 as the same position', () => {
    expect(parseSessionTimeInput('1d 02:00:00', SESSION_72H_US)).toBe(
      26 * HOUR_US,
    );
    expect(parseSessionTimeInput('26:00:00', SESSION_72H_US)).toBe(
      26 * HOUR_US,
    );
  });

  it('accepts a whole-day input as shown on the ruler', () => {
    expect(parseSessionTimeInput('2d', SESSION_72H_US)).toBe(48 * HOUR_US);
  });

  it('rejects a day input past the session end', () => {
    expect(parseSessionTimeInput('3d 00:00:01', SESSION_72H_US)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseSessionTimeInput('12:75:00', SESSION_72H_US)).toBeNull();
    expect(parseSessionTimeInput('abc', SESSION_72H_US)).toBeNull();
  });
});
