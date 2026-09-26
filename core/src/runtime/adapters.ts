/**
 * Channel Adapter Factory & Registry for Link Runtime
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

export type AdapterFactory = (token: string) => IChannelAdapter;

const adapterRegistry = new Map<string, AdapterFactory>();

export function registerAdapterFactory(platform: string, factory: AdapterFactory): void {
  adapterRegistry.set(platform.toLowerCase(), factory);
}

export function createAdapter(platform: string, token: string): IChannelAdapter {
  const factory = adapterRegistry.get(platform.toLowerCase());
  if (factory) {
    return factory(token);
  }

  // Fallback try dynamic require for standard adapters
  try {
    if (platform.toLowerCase() === 'telegram') {
      const { TelegramAdapter } = require('@link-lang/adapter-telegram');
      return new TelegramAdapter(token);
    }
    if (platform.toLowerCase() === 'discord') {
      const { DiscordAdapter } = require('@link-lang/adapter-discord');
      return new DiscordAdapter(token);
    }
    if (platform.toLowerCase() === 'vk') {
      const { VkAdapter } = require('@link-lang/adapter-vk');
      return new VkAdapter(token);
    }
  } catch {}

  // Fallback mock adapter
  return new DefaultMockAdapter(platform, token);
}

class DefaultMockAdapter implements IChannelAdapter {
  private messageHandlers: ((msg: BotMessage, ctx: BotContext) => Promise<void> | void)[] = [];
  private commandHandlers: Map<string, (params: Record<string, string>, ctx: BotContext) => Promise<void> | void> = new Map();

  constructor(public platform: string, public token: string) {}

  async connect(): Promise<void> {
    console.log(`[${this.platform} Adapter] Connected with token ${this.token.slice(0, 5)}...`);
  }
  async disconnect(): Promise<void> {}
  async sendMessage(chatId: string, text: string): Promise<void> {
    console.log(`[${this.platform} Bot -> ${chatId}]: ${text}`);
  }
  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void {
    this.messageHandlers.push(handler);
  }
  onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void {
    this.commandHandlers.set(pattern, handler);
  }
}
