import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForFonts } from '../../ui/src/utils/waitForFonts.js';

const original = Object.getOwnPropertyDescriptor(document, 'fonts');
function setFonts(fonts) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  if (original) Object.defineProperty(document, 'fonts', original);
  else delete document.fonts;
});

describe('font readiness deadline', () => {
  it.each([undefined, {}, { ready: true }])('resolves without a usable Font Loading API: %j', async (fonts) => {
    setFonts(fonts);
    await expect(waitForFonts()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for fonts and clears the unused deadline after success', async () => {
    let finish;
    setFonts({ ready: new Promise((resolve) => { finish = resolve; }) });
    const ready = vi.fn();
    const waiting = waitForFonts().then(ready);
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    finish();
    await waiting;
    expect(ready).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats a failed font load as settled and clears its deadline', async () => {
    setFonts({ ready: Promise.reject(new Error('font fixture unavailable')) });
    await expect(waitForFonts()).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a never-settling font load by the requested deadline', async () => {
    setFonts({ ready: new Promise(() => {}) });
    const ready = vi.fn();
    const waiting = waitForFonts(50).then(ready);
    await vi.advanceTimersByTimeAsync(49);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(ready).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
