import { describe, it, expect } from 'vitest';
import { isTextInputTarget } from './keyboardTarget';

describe('isTextInputTarget', () => {
  it('returns true for input elements', () => {
    expect(isTextInputTarget(document.createElement('input'))).toBe(true);
  });

  it('returns true for textarea elements', () => {
    expect(isTextInputTarget(document.createElement('textarea'))).toBe(true);
  });

  it('returns true for contentEditable elements', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isTextInputTarget(el)).toBe(true);
  });

  it('returns false for a plain, non-editable element', () => {
    expect(isTextInputTarget(document.createElement('div'))).toBe(false);
  });

  it('returns false when there is no target', () => {
    expect(isTextInputTarget(null)).toBe(false);
  });
});
