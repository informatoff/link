import { describe, it, expect, vi } from 'vitest';
import { TelegramAdapter } from '../src/index.js';

describe('TelegramAdapter', () => {
  it('connects and receives updates', async () => {
    const adapter = new TelegramAdapter('mock_token');
    await adapter.connect();
    expect(adapter.platform).toBe('telegram');

    const handler = vi.fn();
    adapter.onMessage(handler);
    await adapter.simulateUpdate('Hello Telegram');

    expect(handler).toHaveBeenCalled();
  });

  it('sends Markdown messages with a reply keyboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const adapter = new TelegramAdapter('test-token');
      const keyboard = { keyboard: [[{ text: 'Stats' }, { text: 'Help' }]] };

      await adapter.sendMessage('12345', '*Hello*', {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: '12345',
            text: '*Hello*',
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }),
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles inline button callbacks and acknowledges them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const adapter = new TelegramAdapter('test-token');
      const handler = vi.fn();
      adapter.onMessage(handler);

      await adapter.simulateCallback('stats');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'stats', isCallback: true }),
        expect.objectContaining({ chat: '12345', user: '999' })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/answerCallbackQuery',
        expect.objectContaining({ method: 'POST' })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
