import { describe, it, expect, vi } from 'vitest';
import { VkAdapter } from '../src/index.js';

describe('VkAdapter', () => {
  it('connects and receives updates', async () => {
    const adapter = new VkAdapter('mock_token');
    await adapter.connect();
    expect(adapter.platform).toBe('vk');

    const handler = vi.fn();
    adapter.onMessage(handler);
    await adapter.simulateUpdate('Hello VK');

    expect(handler).toHaveBeenCalled();
  });
});
