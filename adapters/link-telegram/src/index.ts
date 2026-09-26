/**
 * Telegram Bot API Channel Adapter for Link Language
 * Supports Real HTTPS Long Polling & REST calls to Telegram Bot API.
 */

export interface BotMessage {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  text: string;
  isCallback?: boolean;
  platform: string;
  rawPayload: any;
}

export interface BotContext {
  chat: string;
  user: string;
  channelName: string;
  platform: string;
  message: BotMessage;
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: unknown;
}

export interface IChannelAdapter {
  platform: string;
  token: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void>;
  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void;
}

export class TelegramAdapter implements IChannelAdapter {
  public platform = 'telegram';
  public token: string;
  private isConnected = false;
  private offset = 0;
  private pollTimeout?: NodeJS.Timeout;
  private messageHandlers: ((msg: BotMessage, ctx: BotContext) => Promise<void> | void)[] = [];
  private commandHandlers: Map<string, (params: Record<string, string>, ctx: BotContext) => Promise<void> | void> = new Map();

  constructor(token: string) {
    this.token = token;
  }

  get apiBase(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  isMockToken(): boolean {
    return !this.token || this.token.startsWith('mock_') || this.token === 'TG_TOKEN';
  }

  async connect(): Promise<void> {
    this.isConnected = true;

    if (this.isMockToken()) {
      console.log(`[TelegramAdapter] Mock mode enabled for token '${this.token}'`);
      return;
    }

    try {
      // Test credentials with getMe
      const res = await fetch(`${this.apiBase}/getMe`);
      const data = await res.json() as any;
      if (data.ok) {
        console.log(`[TelegramAdapter] Connected as @${data.result.username} (${data.result.first_name})`);
        this.startLongPolling();
      } else {
        console.error(`[TelegramAdapter] Auth failed: ${data.description}`);
      }
    } catch (err: any) {
      console.error(`[TelegramAdapter] Network error during connect: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    if (this.pollTimeout) clearTimeout(this.pollTimeout);
    console.log('[TelegramAdapter] Disconnected.');
  }

  async sendMessage(chatId: string, text: string, options: SendMessageOptions = {}): Promise<void> {
    if (this.isMockToken()) {
      console.log(`[Telegram Bot -> ${chatId}]: ${text}`);
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parse_mode ?? 'HTML',
          ...(options.reply_markup === undefined ? {} : { reply_markup: options.reply_markup }),
        }),
      });
      const data = await res.json() as any;
      if (!data.ok) {
        console.error(`[TelegramAdapter] sendMessage error: ${data.description}`);
      }
    } catch (err: any) {
      console.error(`[TelegramAdapter] Failed to send message: ${err.message}`);
    }
  }

  private async startLongPolling(): Promise<void> {
    while (this.isConnected) {
      try {
        const url = `${this.apiBase}/getUpdates?offset=${this.offset}&timeout=20`;
        const res = await fetch(url);
        const data = await res.json() as any;

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            if (update.callback_query) {
              await this.handleIncomingCallback(update.callback_query);
            } else if (update.message && update.message.text) {
              await this.handleIncomingMessage(update.message);
            }
          }
        }
      } catch (err: any) {
        if (!this.isConnected) break;
        console.error(`[TelegramAdapter] Long polling error: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleIncomingMessage(tgMsg: any): Promise<void> {
    const chatId = String(tgMsg.chat.id);
    const userId = String(tgMsg.from?.id ?? '');
    const userName = tgMsg.from?.username || tgMsg.from?.first_name || 'User';
    const text = tgMsg.text ?? '';

    const msg: BotMessage = {
      id: String(tgMsg.message_id),
      chatId,
      authorId: userId,
      authorName: userName,
      text,
      isCallback: Boolean(tgMsg.is_callback),
      platform: 'telegram',
      rawPayload: tgMsg,
    };

    const ctx: BotContext = {
      chat: chatId,
      user: userId,
      channelName: 'tg',
      platform: 'telegram',
      message: msg,
    };

    // Check command matching
    for (const [pattern, handler] of this.commandHandlers.entries()) {
      const match = this.matchRoutePattern(pattern, text);
      if (match.matched) {
        await handler(match.params, ctx);
        return;
      }
    }

    // Trigger generic message handlers
    for (const handler of this.messageHandlers) {
      await handler(msg, ctx);
    }
  }

  private async handleIncomingCallback(callback: any): Promise<void> {
    const callbackId = String(callback.id ?? '');
    if (callbackId) await this.answerCallbackQuery(callbackId);
    if (!callback.message?.chat) return;

    await this.handleIncomingMessage({
      ...callback.message,
      from: callback.from,
      text: String(callback.data ?? ''),
      is_callback: true,
      callback_query_id: callbackId,
    });
  }

  private async answerCallbackQuery(callbackId: string): Promise<void> {
    if (this.isMockToken()) return;

    try {
      const res = await fetch(`${this.apiBase}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId }),
      });
      const data = await res.json() as any;
      if (!data.ok) {
        console.error(`[TelegramAdapter] answerCallbackQuery error: ${data.description}`);
      }
    } catch (err: any) {
      console.error(`[TelegramAdapter] Failed to answer callback: ${err.message}`);
    }
  }

  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void {
    this.messageHandlers.push(handler);
  }

  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void {
    this.commandHandlers.set(pattern, handler);
  }

  /** Simulate receiving an incoming Telegram update (for local unit testing) */
  async simulateUpdate(text: string, chatId = '12345', userId = '999', userName = 'Alex'): Promise<void> {
    await this.handleIncomingMessage({
      message_id: Date.now(),
      chat: { id: chatId },
      from: { id: userId, username: userName },
      text,
    });
  }

  async simulateCallback(data: string, chatId = '12345', userId = '999', userName = 'Alex'): Promise<void> {
    await this.handleIncomingCallback({
      id: String(Date.now()),
      data,
      message: {
        message_id: Date.now(),
        chat: { id: chatId },
      },
      from: { id: userId, username: userName },
    });
  }

  private matchRoutePattern(pattern: string, text: string): { matched: boolean; params: Record<string, string> } {
    const patternParts = pattern.trim().split(/\s+/);
    const textParts = text.trim().split(/\s+/);

    if (patternParts.length === 0 || textParts.length === 0) {
      return { matched: false, params: {} };
    }

    if (patternParts[0] !== textParts[0]) {
      return { matched: false, params: {} };
    }

    const params: Record<string, string> = {};
    for (let i = 1; i < patternParts.length; i++) {
      const p = patternParts[i];
      const isOptional = p.endsWith('?}') && p.startsWith('{');
      const paramName = p.replace(/^\{|\?\ ?\}$/g, '').replace(/\}$/, '');

      const val = textParts[i];
      if (!val && !isOptional) {
        return { matched: false, params: {} };
      }
      if (val) {
        params[paramName] = val;
      }
    }

    return { matched: true, params };
  }
}
