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
export declare class DiscordAdapter {
    platform: string;
    token: string;
    private isConnected;
    private messageHandlers;
    private commandHandlers;
    constructor(token: string);
    isMockToken(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(chatId: string, text: string): Promise<void>;
    onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
    simulateUpdate(text: string, chatId?: string, userId?: string, userName?: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map