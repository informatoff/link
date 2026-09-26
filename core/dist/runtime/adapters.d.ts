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
    onCommand(pattern: string, handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void): void;
}
export type AdapterFactory = (token: string) => IChannelAdapter;
export declare function registerAdapterFactory(platform: string, factory: AdapterFactory): void;
export declare function createAdapter(platform: string, token: string): IChannelAdapter;
//# sourceMappingURL=adapters.d.ts.map