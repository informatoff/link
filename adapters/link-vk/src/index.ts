/**
 * VK Bots API Channel Adapter for Link Language
 * Supports Real HTTPS LongPoll Server & REST calls to VK API.
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

export interface IChannelAdapter {
  platform: string;
  token: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<void>;
  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void;
}

export class VkAdapter implements IChannelAdapter {
  public platform = 'vk';
  public token: string;
  public groupId?: string;
  private isConnected = false;
  private server = '';
  private key = '';
  private ts = '';
  private messageHandlers: ((msg: BotMessage, ctx: BotContext) => Promise<void> | void)[] = [];
  private commandHandlers: Map<string, (params: Record<string, string>, ctx: BotContext) => Promise<void> | void> = new Map();

  constructor(token: string, groupId?: string) {
    this.token = token;
    this.groupId = groupId;
  }

  isMockToken(): boolean {
    return !this.token || this.token.startsWith('mock_') || this.token === 'VK_TOKEN';
  }

  async connect(): Promise<void> {
    this.isConnected = true;

    if (this.isMockToken()) {
      console.log(`[VkAdapter] Mock mode enabled for token '${this.token}'`);
      return;
    }

    try {
      // Get Group ID if not passed
      if (!this.groupId) {
        const groupRes = await fetch(`https://api.vk.com/method/groups.getById?access_token=${this.token}&v=5.199`);
        const groupData = await groupRes.json() as any;
        if (groupData.response && groupData.response.groups?.[0]) {
          this.groupId = String(groupData.response.groups[0].id);
        }
      }

      // Initialize LongPoll Server
      const lpRes = await fetch(
        `https://api.vk.com/method/groups.getLongPollServer?group_id=${this.groupId}&access_token=${this.token}&v=5.199`
      );
      const lpData = await lpRes.json() as any;

      if (lpData.response) {
        this.server = lpData.response.server;
        this.key = lpData.response.key;
        this.ts = lpData.response.ts;
        console.log(`[VkAdapter] Connected to VK LongPoll Server (Group ID: ${this.groupId})`);
        this.startLongPolling();
      } else {
        console.error(`[VkAdapter] Failed to get VK LongPoll server: ${JSON.stringify(lpData.error)}`);
      }
    } catch (err: any) {
      console.error(`[VkAdapter] Network error during connect: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('[VkAdapter] Disconnected.');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (this.isMockToken()) {
      console.log(`[VK Bot -> Peer ${chatId}]: ${text}`);
      return;
    }

    try {
      const randomId = Math.floor(Math.random() * 2147483647);
      const url = `https://api.vk.com/method/messages.send?peer_id=${chatId}&message=${encodeURIComponent(
        text
      )}&random_id=${randomId}&access_token=${this.token}&v=5.199`;
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.error) {
        console.error(`[VkAdapter] messages.send error: ${data.error.error_msg}`);
      }
    } catch (err: any) {
      console.error(`[VkAdapter] Failed to send VK message: ${err.message}`);
    }
  }

  private async startLongPolling(): Promise<void> {
    while (this.isConnected) {
      try {
        const url = `${this.server}?act=a_check&key=${this.key}&ts=${this.ts}&wait=25`;
        const res = await fetch(url);
        const data = await res.json() as any;

        if (data.failed) {
          if (data.failed === 1) this.ts = data.ts;
          else {
            // Re-initialize server credentials
            await this.connect();
            break;
          }
        }

        if (data.ts) this.ts = data.ts;

        if (Array.isArray(data.updates)) {
          for (const update of data.updates) {
            if (update.type === 'message_new' && update.object?.message) {
              await this.handleIncomingMessage(update.object.message);
            }
          }
        }
      } catch (err: any) {
        if (!this.isConnected) break;
        console.error(`[VkAdapter] LongPoll error: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleIncomingMessage(vkMsg: any): Promise<void> {
    const chatId = String(vkMsg.peer_id || vkMsg.from_id);
    const userId = String(vkMsg.from_id);
    const text = vkMsg.text ?? '';

    const msg: BotMessage = {
      id: String(vkMsg.id),
      chatId,
      authorId: userId,
      authorName: `id${userId}`,
      text,
      platform: 'vk',
      rawPayload: vkMsg,
    };

    const ctx: BotContext = {
      chat: chatId,
      user: userId,
      channelName: 'vk',
      platform: 'vk',
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

  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void {
    this.messageHandlers.push(handler);
  }

  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void {
    this.commandHandlers.set(pattern, handler);
  }

  async simulateUpdate(text: string, chatId = 'vk-peer-100', userId = 'vk-user-200', userName = 'VkUser'): Promise<void> {
    await this.handleIncomingMessage({
      id: Date.now(),
      peer_id: chatId,
      from_id: userId,
      text,
    });
  }
}
