import { afterEach, describe, expect, it, vi } from 'vitest';
import * as readline from 'node:readline/promises';
import { Environment } from '../src/runtime/environment.js';
import { makeString } from '../src/runtime/value.js';
import { setupBuiltins } from '../src/runtime/builtins.js';

vi.mock('node:readline/promises', () => ({ createInterface: vi.fn() }));

afterEach(() => {
  vi.mocked(readline.createInterface).mockReset();
});

describe('Link input builtin', () => {
  it('reads multiple lines as strings and closes the interface on cleanup', async () => {
    const next = vi.fn()
      .mockResolvedValueOnce({ value: 'Link', done: false })
      .mockResolvedValueOnce({ value: ' works', done: false });
    const asyncIterator = vi.fn(() => ({ next }));
    const close = vi.fn();
    const createInterface = vi.mocked(readline.createInterface);
    createInterface.mockReturnValue({
      [Symbol.asyncIterator]: asyncIterator,
      close,
    } as unknown as readline.Interface);

    const env = new Environment();
    const cleanup = setupBuiltins(env);
    const input = env.getVar('input');
    if (input.type !== 'native_function') throw new Error('input() is not native');

    try {
      const first = await input.fn([makeString('First: ')], env);
      const second = await input.fn([makeString('Second: ')], env);

      expect(first).toEqual(makeString('Link'));
      expect(second).toEqual(makeString(' works'));
      expect(createInterface).toHaveBeenCalledOnce();
      expect(asyncIterator).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledTimes(2);

      cleanup();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      cleanup();
    }
  });
});
