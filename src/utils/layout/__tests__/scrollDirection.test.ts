import { describe, it, expect } from 'vitest';
import { ScrollDirection, readScrollDirection } from '../scrollDirection';

describe('readScrollDirection', () => {
  it('points down in the upper half of the scroll range', () => {
    expect(readScrollDirection(100, 1000, 600)).toBe(ScrollDirection.Down);
  });

  it('points up in the lower half of the scroll range', () => {
    expect(readScrollDirection(200, 1000, 600)).toBe(ScrollDirection.Up);
  });

  it('returns null when the content does not overflow', () => {
    expect(readScrollDirection(0, 600, 600)).toBeNull();
  });
});
