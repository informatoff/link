import { describe, it, expect, vi } from 'vitest';
import { DiscordAdapter } from '../src/index.js';

describe('DiscordAdapter', () => {
  it('connects and receives updates', async () => {
    const adapter = new DiscordAdapter('mock_token');
    await adapter.connect();
    expect(adapter.platform).toBe('discord');

    const handler = vi.fn();
    adapter.onMessage(handler);
    await adapter.simulateUpdate('Hello Discord');

    expect(handler).toHaveBeenCalled();
  });
});
