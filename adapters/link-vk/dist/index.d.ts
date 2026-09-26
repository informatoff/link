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
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
}
export declare class VkAdapter implements IChannelAdapter {
    platform: string;
    token: string;
    groupId?: string;
    private isConnected;
    private server;
    private key;
    private ts;
    private messageHandlers;
    private commandHandlers;
    constructor(token: string, groupId?: string);
    isMockToken(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(chatId: string, text: string): Promise<void>;
    private startLongPolling;
    private handleIncomingMessage;
    onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
    simulateUpdate(text: string, chatId?: string, userId?: string, userName?: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map