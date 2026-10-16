import { describe, expect, it } from 'vitest';
import { isKeyboardOccluding } from '../src/lib/mobileViewport';

describe('iPhone visual viewport keyboard detection', () => {
  it('does not hide navigation for Safari browser chrome', () => {
    expect(isKeyboardOccluding(844, 790, 0, true)).toBe(false);
  });
  it('hides bottom actions for an editable field when keyboard opens', () => {
    expect(isKeyboardOccluding(844, 500, 0, true)).toBe(true);
  });
  it('does not hide navigation when no editable field is focused', () => {
    expect(isKeyboardOccluding(844, 500, 0, false)).toBe(false);
  });
  it('accounts for visual viewport offset and invalid geometry', () => {
    expect(isKeyboardOccluding(844, 600, 100, true)).toBe(false);
    expect(isKeyboardOccluding(844, Number.NaN, 0, true)).toBe(false);
  });
});
