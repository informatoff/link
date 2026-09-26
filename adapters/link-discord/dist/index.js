"use strict";
/**
 * Discord Bot Gateway Adapter for Link Language
 * Supports REST Calls & Gateway Polling to Discord API v10.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordAdapter = void 0;
class DiscordAdapter {
    platform = 'discord';
    token;
    isConnected = false;
    messageHandlers = [];
    commandHandlers = new Map();
    constructor(token) {
        this.token = token;
    }
    isMockToken() {
        return !this.token || this.token.startsWith('mock_') || this.token === 'DC_TOKEN';
    }
    async connect() {
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
            const data = await res.json();
            if (data.username) {
                console.log(`[DiscordAdapter] Connected as ${data.username}#${data.discriminator} (ID: ${data.id})`);
            }
            else {
                console.error(`[DiscordAdapter] Auth failed: ${data.message}`);
            }
        }
        catch (err) {
            console.error(`[DiscordAdapter] Network error during connect: ${err.message}`);
        }
    }
    async disconnect() {
        this.isConnected = false;
        console.log('[DiscordAdapter] Disconnected.');
    }
    async sendMessage(chatId, text) {
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
            const data = await res.json();
            if (data.code) {
                console.error(`[DiscordAdapter] sendMessage error: ${data.message}`);
            }
        }
        catch (err) {
            console.error(`[DiscordAdapter] Failed to send Discord message: ${err.message}`);
        }
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onCommand(pattern, handler) {
        this.commandHandlers.set(pattern, handler);
    }
    async simulateUpdate(text, chatId = 'discord-channel-1', userId = 'disc-user-1', userName = 'DiscordUser') {
        const msg = {
            id: String(Date.now()),
            chatId,
            authorId: userId,
            authorName: userName,
            text,
            platform: 'discord',
            rawPayload: { id: '1', content: text },
        };
        const ctx = {
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
exports.DiscordAdapter = DiscordAdapter;
//# sourceMappingURL=index.js.map