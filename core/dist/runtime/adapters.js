"use strict";
/**
 * Channel Adapter Factory & Registry for Link Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdapterFactory = registerAdapterFactory;
exports.createAdapter = createAdapter;
const adapterRegistry = new Map();
function registerAdapterFactory(platform, factory) {
    adapterRegistry.set(platform.toLowerCase(), factory);
}
function createAdapter(platform, token) {
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
    }
    catch { }
    // Fallback mock adapter
    return new DefaultMockAdapter(platform, token);
}
class DefaultMockAdapter {
    platform;
    token;
    messageHandlers = [];
    commandHandlers = new Map();
    constructor(platform, token) {
        this.platform = platform;
        this.token = token;
    }
    async connect() {
        console.log(`[${this.platform} Adapter] Connected with token ${this.token.slice(0, 5)}...`);
    }
    async disconnect() { }
    async sendMessage(chatId, text) {
        console.log(`[${this.platform} Bot -> ${chatId}]: ${text}`);
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onCommand(pattern, handler) {
        this.commandHandlers.set(pattern, handler);
    }
}
//# sourceMappingURL=adapters.js.map