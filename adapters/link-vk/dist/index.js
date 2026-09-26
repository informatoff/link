"use strict";
/**
 * VK Bots API Channel Adapter for Link Language
 * Supports Real HTTPS LongPoll Server & REST calls to VK API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VkAdapter = void 0;
class VkAdapter {
    platform = 'vk';
    token;
    groupId;
    isConnected = false;
    server = '';
    key = '';
    ts = '';
    messageHandlers = [];
    commandHandlers = new Map();
    constructor(token, groupId) {
        this.token = token;
        this.groupId = groupId;
    }
    isMockToken() {
        return !this.token || this.token.startsWith('mock_') || this.token === 'VK_TOKEN';
    }
    async connect() {
        this.isConnected = true;
        if (this.isMockToken()) {
            console.log(`[VkAdapter] Mock mode enabled for token '${this.token}'`);
            return;
        }
        try {
            // Get Group ID if not passed
            if (!this.groupId) {
                const groupRes = await fetch(`https://api.vk.com/method/groups.getById?access_token=${this.token}&v=5.199`);
                const groupData = await groupRes.json();
                if (groupData.response && groupData.response.groups?.[0]) {
                    this.groupId = String(groupData.response.groups[0].id);
                }
            }
            // Initialize LongPoll Server
            const lpRes = await fetch(`https://api.vk.com/method/groups.getLongPollServer?group_id=${this.groupId}&access_token=${this.token}&v=5.199`);
            const lpData = await lpRes.json();
            if (lpData.response) {
                this.server = lpData.response.server;
                this.key = lpData.response.key;
                this.ts = lpData.response.ts;
                console.log(`[VkAdapter] Connected to VK LongPoll Server (Group ID: ${this.groupId})`);
                this.startLongPolling();
            }
            else {
                console.error(`[VkAdapter] Failed to get VK LongPoll server: ${JSON.stringify(lpData.error)}`);
            }
        }
        catch (err) {
            console.error(`[VkAdapter] Network error during connect: ${err.message}`);
        }
    }
    async disconnect() {
        this.isConnected = false;
        console.log('[VkAdapter] Disconnected.');
    }
    async sendMessage(chatId, text) {
        if (this.isMockToken()) {
            console.log(`[VK Bot -> Peer ${chatId}]: ${text}`);
            return;
        }
        try {
            const randomId = Math.floor(Math.random() * 2147483647);
            const url = `https://api.vk.com/method/messages.send?peer_id=${chatId}&message=${encodeURIComponent(text)}&random_id=${randomId}&access_token=${this.token}&v=5.199`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.error) {
                console.error(`[VkAdapter] messages.send error: ${data.error.error_msg}`);
            }
        }
        catch (err) {
            console.error(`[VkAdapter] Failed to send VK message: ${err.message}`);
        }
    }
    async startLongPolling() {
        while (this.isConnected) {
            try {
                const url = `${this.server}?act=a_check&key=${this.key}&ts=${this.ts}&wait=25`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.failed) {
                    if (data.failed === 1)
                        this.ts = data.ts;
                    else {
                        // Re-initialize server credentials
                        await this.connect();
                        break;
                    }
                }
                if (data.ts)
                    this.ts = data.ts;
                if (Array.isArray(data.updates)) {
                    for (const update of data.updates) {
                        if (update.type === 'message_new' && update.object?.message) {
                            await this.handleIncomingMessage(update.object.message);
                        }
                    }
                }
            }
            catch (err) {
                if (!this.isConnected)
                    break;
                console.error(`[VkAdapter] LongPoll error: ${err.message}`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
    }
    async handleIncomingMessage(vkMsg) {
        const chatId = String(vkMsg.peer_id || vkMsg.from_id);
        const userId = String(vkMsg.from_id);
        const text = vkMsg.text ?? '';
        const msg = {
            id: String(vkMsg.id),
            chatId,
            authorId: userId,
            authorName: `id${userId}`,
            text,
            platform: 'vk',
            rawPayload: vkMsg,
        };
        const ctx = {
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
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onCommand(pattern, handler) {
        this.commandHandlers.set(pattern, handler);
    }
    async simulateUpdate(text, chatId = 'vk-peer-100', userId = 'vk-user-200', userName = 'VkUser') {
        await this.handleIncomingMessage({
            id: Date.now(),
            peer_id: chatId,
            from_id: userId,
            text,
        });
    }
}
exports.VkAdapter = VkAdapter;
//# sourceMappingURL=index.js.map