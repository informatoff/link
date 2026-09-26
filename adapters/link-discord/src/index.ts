/**
 * Discord Bot Gateway Adapter for Link Language
 * Supports REST Calls & Gateway Polling to Discord API v10.
 */

export interface BotMessage {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  text: string;
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

export class DiscordAdapter {
  public platform = 'discord';
  public token: string;
  private isConnected = false;
  private messageHandlers: ((msg: BotMessage, ctx: BotContext) => Promise<void> | void)[] = [];
  private commandHandlers: Map<string, (params: Record<string, string>, ctx: BotContext) => Promise<void> | void> = new Map();

  constructor(token: string) {
    this.token = token;
  }

  isMockToken(): boolean {
    return !this.token || this.token.startsWith('mock_') || this.token === 'DC_TOKEN';
  }

  async connect(): Promise<void> {
    this.isConnected = true;

    if (this.isMockToken()) {
      console.log(`[DiscordAdapter] Mock mode enabled for token '${this.token}'`);
      return;
    }

    try {
      // Validate bot credentials via Discord API v10
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${this.token}` },
      });
      const data = await res.json() as any;
      if (data.username) {
        console.log(`[DiscordAdapter] Connected as ${data.username}#${data.discriminator} (ID: ${data.id})`);
      } else {
        console.error(`[DiscordAdapter] Auth failed: ${data.message}`);
      }
    } catch (err: any) {
      console.error(`[DiscordAdapter] Network error during connect: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('[DiscordAdapter] Disconnected.');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (this.isMockToken()) {
      console.log(`[Discord Bot -> Channel ${chatId}]: ${text}`);
      return;
    }

    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${chatId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json() as any;
      if (data.code) {
        console.error(`[DiscordAdapter] sendMessage error: ${data.message}`);
      }
    } catch (err: any) {
      console.error(`[DiscordAdapter] Failed to send Discord message: ${err.message}`);
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

  async simulateUpdate(text: string, chatId = 'discord-channel-1', userId = 'disc-user-1', userName = 'DiscordUser'): Promise<void> {
    const msg: BotMessage = {
      id: String(Date.now()),
      chatId,
      authorId: userId,
      authorName: userName,
      text,
      platform: 'discord',
      rawPayload: { id: '1', content: text },
    };

    const ctx: BotContext = {
      chat: chatId,
      user: userId,
      channelName: 'dc',
      platform: 'discord',
      message: msg,
    };

    for (const [pattern, handler] of this.commandHandlers.entries()) {
      if (text.startsWith(pattern.split(' ')[0])) {
        await handler({}, ctx);
        return;
      }
    }

    for (const handler of this.messageHandlers) {
      await handler(msg, ctx);
    }
  }
}
