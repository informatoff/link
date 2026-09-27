/**
 * VK Bots API Channel Adapter for Link Language
 * Supports Real HTTPS LongPoll Server & REST calls to VK API.
 *
 * ДОРАБОТАНО:
 * 1. Параметры команд (/kick {userId}) теперь реально парсятся
 *    из текста сообщения через паттерн route, а не всегда {}.
 * 2. sendMessage поддерживает options: { keyboard, parse_mode и т.д. }
 *    и реально передаёт reply_markup/keyboard в VK API.
 * 3. Добавлены события вступления/исключения участника беседы
 *    (chat_invite_user / chat_kick_user) и обычной группы (group_join).
 * 4. Добавлена базовая проверка прав администратора беседы через
 *    messages.getConversationMembers, доступная как ctx.isAdmin
 *    (используется интерпретатором для require permission: "admin").
 *
 * ВАЖНО: этот файл — предположение о том, как должен выглядеть
 * доработанный адаптер, написанное без доступа к остальному ядру
 * Link (packages/core). Сигнатуры IChannelAdapter, BotMessage,
 * BotContext расширены НЕОБРАТИМО СОВМЕСТИМО (только добавлены
 * опциональные поля), чтобы не сломать остальной интерпретатор —
 * но я не могу гарантировать, что core действительно вызывает
 * эти новые поля/методы так, как я предполагаю. Нужно свериться
 * с packages/core на предмет того, как он читает onEvent/require.
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
  groupId?: string;
  isAdmin?: boolean; // заполняется адаптером перед вызовом require permission: "admin"
}

// Событие членства (вступление/выход) в беседе или группе
export interface MemberEvent {
  chatId: string;
  userId: string;
  actorId?: string; // кто пригласил/кикнул (если применимо)
  platform: string;
}

export interface SendOptions {
  // Простая reply-клавиатура VK: массив рядов кнопок с текстом
  keyboard?: {
    buttons: { text: string; color?: 'primary' | 'secondary' | 'negative' | 'positive'; payload?: any }[][];
    inline?: boolean;
    one_time?: boolean;
  };
  // Произвольный уже готовый VK keyboard-объект (если нужен полный контроль)
  rawKeyboard?: any;
}

export interface IChannelAdapter {
  platform: string;
  token: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(chatId: string, text: string, options?: SendOptions): Promise<void>;
  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void;
  // Новое: подписка на вступление/выход участника
  onMemberJoin?(handler: (ev: MemberEvent, ctx: BotContext) => Promise<void> | void): void;
  onMemberLeave?(handler: (ev: MemberEvent, ctx: BotContext) => Promise<void> | void): void;
}

// Компилирует route-паттерн вида "/kick {userId}" или "/ban {userId} {reason?}"
// в регулярное выражение с именованными группами.
function compileRoutePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  // Экранируем спецсимволы regex, кроме плейсхолдеров {name} / {name?}
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (ch) => {
    return ch === '{' || ch === '}' ? ch : '\\' + ch;
  });

  const regexStr = escaped.replace(/\{(\w+)(\?)?\}/g, (_m, name: string, optional: string | undefined) => {
    paramNames.push(name);
    // Обязательный параметр: один "токен" без пробелов, но может быть последним и включать пробелы,
    // если это последний параметр в паттерне (например {reason} в конце команды).
    return optional ? '(?:\\s+(\\S.*))?' : '\\s+(\\S+)';
  });

  return { regex: new RegExp('^' + regexStr + '\\s*$'), paramNames };
}

interface CompiledCommand {
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void;
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
  private commands: CompiledCommand[] = [];
  private memberJoinHandlers: ((ev: MemberEvent, ctx: BotContext) => Promise<void> | void)[] = [];
  private memberLeaveHandlers: ((ev: MemberEvent, ctx: BotContext) => Promise<void> | void)[] = [];

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
      if (!this.groupId) {
        const groupRes = await fetch(`https://api.vk.com/method/groups.getById?access_token=${this.token}&v=5.199`);
        const groupData = await groupRes.json() as any;
        if (groupData.response && groupData.response.groups?.[0]) {
          this.groupId = String(groupData.response.groups[0].id);
        }
      }

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
      console.error(`[VkAdapter] Network error during connect: ${err?.message ?? JSON.stringify(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('[VkAdapter] Disconnected.');
  }

  // sendMessage теперь принимает options с клавиатурой и реально передаёт её в VK API.
  async sendMessage(chatId: string, text: string, options?: SendOptions): Promise<void> {
    if (this.isMockToken()) {
      console.log(`[VK Bot -> Peer ${chatId}]: ${text}`);
      return;
    }

    try {
      const randomId = Math.floor(Math.random() * 2147483647);
      const params = new URLSearchParams({
        peer_id: chatId,
        message: text,
        random_id: String(randomId),
        access_token: this.token,
        v: '5.199',
      });

      const keyboardObj = this.buildKeyboard(options);
      if (keyboardObj) {
        params.set('keyboard', JSON.stringify(keyboardObj));
      }

      const url = `https://api.vk.com/method/messages.send?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.error) {
        console.error(`[VkAdapter] messages.send error: ${data.error.error_msg}`);
      }
    } catch (err: any) {
      console.error(`[VkAdapter] Failed to send VK message: ${err?.message ?? JSON.stringify(err)}`);
    }
  }

  // Строит VK keyboard-объект либо из упрощённого SendOptions.keyboard,
  // либо пропускает уже готовый rawKeyboard как есть.
  private buildKeyboard(options?: SendOptions): any | null {
    if (!options) return null;
    if (options.rawKeyboard) return options.rawKeyboard;
    if (!options.keyboard) return null;

    return {
      one_time: options.keyboard.one_time ?? false,
      inline: options.keyboard.inline ?? false,
      buttons: options.keyboard.buttons.map((row) =>
        row.map((btn) => ({
          action: {
            type: 'text',
            label: btn.text,
            payload: btn.payload ? JSON.stringify(btn.payload) : undefined,
          },
          color: btn.color ?? 'secondary',
        }))
      ),
    };
  }

  private async startLongPolling(): Promise<void> {
    while (this.isConnected) {
      try {
        const url = `${this.server}?act=a_check&key=${this.key}&ts=${this.ts}&wait=25`;
        const res = await fetch(url);
        const data = await res.json() as any;

        if (data.failed) {
          if (data.failed === 1) {
            this.ts = data.ts;
          } else {
            await this.connect();
            break;
          }
        }

        if (data.ts) this.ts = data.ts;

        if (Array.isArray(data.updates)) {
          for (const update of data.updates) {
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        if (!this.isConnected) break;
        // err теперь всегда логируется с фолбэком, чтобы никогда не было "undefined"
        const reason = err?.message || err?.toString?.() || JSON.stringify(err) || 'unknown error';
        console.error(`[VkAdapter] LongPoll error: ${reason}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleUpdate(update: any): Promise<void> {
    switch (update.type) {
      case 'message_new':
        if (update.object?.message) {
          await this.handleIncomingMessage(update.object.message);
        }
        break;

      // Пользователь зашёл в беседу (кто-то его пригласил, либо он сам по ссылке)
      case 'chat_invite_user': {
        const obj = update.object;
        if (!obj) break;
        const chatId = String(obj.peer_id ?? obj.chat_id ?? '');
        const userId = String(obj.member_id ?? '');
        const actorId = obj.user_id != null ? String(obj.user_id) : undefined;
        if (userId && !userId.startsWith('-')) {
          // отрицательный member_id в VK означает "исключён ботом/системой", а не юзер
          await this.emitMemberJoin({ chatId, userId, actorId, platform: 'vk' });
        }
        break;
      }

      // Пользователь вышел/был исключён из беседы
      case 'chat_kick_user': {
        const obj = update.object;
        if (!obj) break;
        const chatId = String(obj.peer_id ?? obj.chat_id ?? '');
        const userId = String(obj.member_id ?? '');
        const actorId = obj.user_id != null ? String(obj.user_id) : undefined;
        await this.emitMemberLeave({ chatId, userId, actorId, platform: 'vk' });
        break;
      }

      // Пользователь вступил в саму группу (не беседу)
      case 'group_join': {
        const obj = update.object;
        if (!obj) break;
        const userId = String(obj.user_id ?? '');
        await this.emitMemberJoin({ chatId: String(this.groupId ?? ''), userId, platform: 'vk' });
        break;
      }

      case 'group_leave': {
        const obj = update.object;
        if (!obj) break;
        const userId = String(obj.user_id ?? '');
        await this.emitMemberLeave({ chatId: String(this.groupId ?? ''), userId, platform: 'vk' });
        break;
      }

      default:
        // остальные типы апдейтов пока игнорируются осознанно
        break;
    }
  }

  private async emitMemberJoin(ev: MemberEvent): Promise<void> {
    const ctx = await this.buildContextForMember(ev);
    for (const handler of this.memberJoinHandlers) {
      await handler(ev, ctx);
    }
  }

  private async emitMemberLeave(ev: MemberEvent): Promise<void> {
    const ctx = await this.buildContextForMember(ev);
    for (const handler of this.memberLeaveHandlers) {
      await handler(ev, ctx);
    }
  }

  private async buildContextForMember(ev: MemberEvent): Promise<BotContext> {
    const emptyMsg: BotMessage = {
      id: '',
      chatId: ev.chatId,
      authorId: ev.userId,
      authorName: `id${ev.userId}`,
      text: '',
      platform: 'vk',
      rawPayload: ev,
    };
    return {
      chat: ev.chatId,
      user: ev.userId,
      channelName: 'vk',
      platform: 'vk',
      message: emptyMsg,
      groupId: this.groupId,
    };
  }

  // Проверяет, является ли userId админом/создателем беседы chatId.
  // Используется перед вызовом хендлеров команд, требующих permission: "admin".
  private async checkIsAdmin(chatId: string, userId: string): Promise<boolean> {
    if (this.isMockToken()) return true;
    try {
      const params = new URLSearchParams({
        peer_id: chatId,
        access_token: this.token,
        v: '5.199',
      });
      const res = await fetch(`https://api.vk.com/method/messages.getConversationMembers?${params.toString()}`);
      const data = await res.json() as any;
      if (data.error || !data.response?.items) return false;

      const member = data.response.items.find((m: any) => String(m.member_id) === userId);
      if (!member) return false;

      // is_admin / is_owner — поля, которые VK отдаёт для участников беседы
      return Boolean(member.is_admin || member.is_owner);
    } catch (err: any) {
      console.error(`[VkAdapter] checkIsAdmin error: ${err?.message ?? JSON.stringify(err)}`);
      return false;
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
      groupId: this.groupId,
    };

    // Пытаемся сматчить зарегистрированные команды по скомпилированным паттернам.
    // Более длинные/специфичные паттерны (с большим числом обязательных параметров)
    // проверяем первыми, чтобы "/kick {userId}" не терялся за общим "/kick".
    const sorted = [...this.commands].sort((a, b) => b.pattern.length - a.pattern.length);

    for (const cmd of sorted) {
      const match = text.match(cmd.regex);
      if (match) {
        const params: Record<string, string> = {};
        cmd.paramNames.forEach((name, i) => {
          params[name] = match[i + 1] ?? '';
        });

        // Заполняем ctx.isAdmin лениво: интерпретатор Link (require permission: "admin")
        // должен сам решить, вызывать ли checkIsAdmin — но на случай, если require
        // просто читает ctx.isAdmin синхронно, считаем права заранее.
        ctx.isAdmin = await this.checkIsAdmin(chatId, userId);

        await cmd.handler(params, ctx);
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
    const { regex, paramNames } = compileRoutePattern(pattern);
    this.commands.push({ pattern, regex, paramNames, handler });
  }

  onMemberJoin(handler: (ev: MemberEvent, ctx: BotContext) => Promise<void> | void): void {
    this.memberJoinHandlers.push(handler);
  }

  onMemberLeave(handler: (ev: MemberEvent, ctx: BotContext) => Promise<void> | void): void {
    this.memberLeaveHandlers.push(handler);
  }

  async simulateUpdate(text: string, chatId = 'vk-peer-100', userId = 'vk-user-200'): Promise<void> {
    await this.handleIncomingMessage({
      id: Date.now(),
      peer_id: chatId,
      from_id: userId,
      text,
    });
  }
}
