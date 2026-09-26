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
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
}
export declare class TelegramAdapter implements IChannelAdapter {
    platform: string;
    token: string;
    private isConnected;
    private offset;
    private pollTimeout?;
    private messageHandlers;
    private commandHandlers;
    constructor(token: string);
    get apiBase(): string;
    isMockToken(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void>;
    private startLongPolling;
    private handleIncomingMessage;
    private handleIncomingCallback;
    private answerCallbackQuery;
    onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
    /** Simulate receiving an incoming Telegram update (for local unit testing) */
    simulateUpdate(text: string, chatId?: string, userId?: string, userName?: string): Promise<void>;
    simulateCallback(data: string, chatId?: string, userId?: string, userName?: string): Promise<void>;
    private matchRoutePattern;
}
//# sourceMappingURL=index.d.ts.map