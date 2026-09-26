"use strict";
/**
 * Telegram Bot API Channel Adapter for Link Language
 * Supports Real HTTPS Long Polling & REST calls to Telegram Bot API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
class TelegramAdapter {
    platform = 'telegram';
    token;
    isConnected = false;
    offset = 0;
    pollTimeout;
    messageHandlers = [];
    commandHandlers = new Map();
    constructor(token) {
        this.token = token;
    }
    get apiBase() {
        return `https://api.telegram.org/bot${this.token}`;
    }
    isMockToken() {
        return !this.token || this.token.startsWith('mock_') || this.token === 'TG_TOKEN';
    }
    async connect() {
        this.isConnected = true;
        if (this.isMockToken()) {
            console.log(`[TelegramAdapter] Mock mode enabled for token '${this.token}'`);
            return;
        }
        try {
            // Test credentials with getMe
            const res = await fetch(`${this.apiBase}/getMe`);
            const data = await res.json();
            if (data.ok) {
                console.log(`[TelegramAdapter] Connected as @${data.result.username} (${data.result.first_name})`);
                this.startLongPolling();
            }
            else {
                console.error(`[TelegramAdapter] Auth failed: ${data.description}`);
            }
        }
        catch (err) {
            console.error(`[TelegramAdapter] Network error during connect: ${err.message}`);
        }
    }
    async disconnect() {
        this.isConnected = false;
        if (this.pollTimeout)
            clearTimeout(this.pollTimeout);
        console.log('[TelegramAdapter] Disconnected.');
    }
    async sendMessage(chatId, text, options = {}) {
        if (this.isMockToken()) {
            console.log(`[Telegram Bot -> ${chatId}]: ${text}`);
            return;
        }
        try {
            const res = await fetch(`${this.apiBase}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: options.parse_mode ?? 'HTML',
                    ...(options.reply_markup === undefined ? {} : { reply_markup: options.reply_markup }),
                }),
            });
            const data = await res.json();
            if (!data.ok) {
                console.error(`[TelegramAdapter] sendMessage error: ${data.description}`);
            }
        }
        catch (err) {
            console.error(`[TelegramAdapter] Failed to send message: ${err.message}`);
        }
    }
    async startLongPolling() {
        while (this.isConnected) {
            try {
                const url = `${this.apiBase}/getUpdates?offset=${this.offset}&timeout=20`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.ok && Array.isArray(data.result)) {
                    for (const update of data.result) {
                        this.offset = update.update_id + 1;
                        if (update.callback_query) {
                            await this.handleIncomingCallback(update.callback_query);
                        }
                        else if (update.message && update.message.text) {
                            await this.handleIncomingMessage(update.message);
                        }
                    }
                }
            }
            catch (err) {
                if (!this.isConnected)
                    break;
                console.error(`[TelegramAdapter] Long polling error: ${err.message}`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
    }
    async handleIncomingMessage(tgMsg) {
        const chatId = String(tgMsg.chat.id);
        const userId = String(tgMsg.from?.id ?? '');
        const userName = tgMsg.from?.username || tgMsg.from?.first_name || 'User';
        const text = tgMsg.text ?? '';
        const msg = {
            id: String(tgMsg.message_id),
            chatId,
            authorId: userId,
            authorName: userName,
            text,
            isCallback: Boolean(tgMsg.is_callback),
            platform: 'telegram',
            rawPayload: tgMsg,
        };
        const ctx = {
            chat: chatId,
            user: userId,
            channelName: 'tg',
            platform: 'telegram',
            message: msg,
        };
        // Check command matching
        for (const [pattern, handler] of this.commandHandlers.entries()) {
            const match = this.matchRoutePattern(pattern, text);
            if (match.matched) {
                await handler(match.params, ctx);
                return;
            }
        }
        // Trigger generic message handlers
        for (const handler of this.messageHandlers) {
            await handler(msg, ctx);
        }
    }
    async handleIncomingCallback(callback) {
        const callbackId = String(callback.id ?? '');
        if (callbackId)
            await this.answerCallbackQuery(callbackId);
        if (!callback.message?.chat)
            return;
        await this.handleIncomingMessage({
            ...callback.message,
            from: callback.from,
            text: String(callback.data ?? ''),
            is_callback: true,
            callback_query_id: callbackId,
        });
    }
    async answerCallbackQuery(callbackId) {
        if (this.isMockToken())
            return;
        try {
            const res = await fetch(`${this.apiBase}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackId }),
            });
            const data = await res.json();
            if (!data.ok) {
                console.error(`[TelegramAdapter] answerCallbackQuery error: ${data.description}`);
            }
        }
        catch (err) {
            console.error(`[TelegramAdapter] Failed to answer callback: ${err.message}`);
        }
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onCommand(pattern, handler) {
        this.commandHandlers.set(pattern, handler);
    }
    /** Simulate receiving an incoming Telegram update (for local unit testing) */
    async simulateUpdate(text, chatId = '12345', userId = '999', userName = 'Alex') {
        await this.handleIncomingMessage({
            message_id: Date.now(),
            chat: { id: chatId },
            from: { id: userId, username: userName },
            text,
        });
    }
    async simulateCallback(data, chatId = '12345', userId = '999', userName = 'Alex') {
        await this.handleIncomingCallback({
            id: String(Date.now()),
            data,
            message: {
                message_id: Date.now(),
                chat: { id: chatId },
            },
            from: { id: userId, username: userName },
        });
    }
    matchRoutePattern(pattern, text) {
        const patternParts = pattern.trim().split(/\s+/);
        const textParts = text.trim().split(/\s+/);
        if (patternParts.length === 0 || textParts.length === 0) {
            return { matched: false, params: {} };
        }
        if (patternParts[0] !== textParts[0]) {
            return { matched: false, params: {} };
        }
        const params = {};
        for (let i = 1; i < patternParts.length; i++) {
            const p = patternParts[i];
            const isOptional = p.endsWith('?}') && p.startsWith('{');
            const paramName = p.replace(/^\{|\?\ ?\}$/g, '').replace(/\}$/, '');
            const val = textParts[i];
            if (!val && !isOptional) {
                return { matched: false, params: {} };
            }
            if (val) {
                params[paramName] = val;
            }
        }
        return { matched: true, params };
    }
}
exports.TelegramAdapter = TelegramAdapter;
//# sourceMappingURL=index.js.map