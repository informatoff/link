# IChannelAdapter Specification & Architecture

## Overview
Link language allows multi-platform bot development using a single unified syntax:

```link
channel tg = link telegram("TOKEN")
channel dc = link discord("TOKEN")

listen tg, dc {
    route "/start" {
        send(ctx.chat, "Hello from Link!")
    }
}
```

The underlying mechanism that makes `listen tg, dc { ... }` platform-agnostic is the `IChannelAdapter` interface.

---

## TypeScript Interface

```typescript
export interface BotMessage {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  text: string;
  platform: string; // "telegram" | "discord" | "vk"
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

  /** Initialize connection (Long Polling / Webhook / WebSocket Gateway) */
  connect(): Promise<void>;

  /** Close connection and stop event listeners */
  disconnect(): Promise<void>;

  /** Send a message to a specific chat / user */
  sendMessage(chatId: string, text: string, options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: unknown;
  }): Promise<void>;
    send(ctx.chat, "*Hello from Link!*", {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [[{text: "Stats"}, {text: "Help"}]],
        resize_keyboard: true
      }
    })

  /** Register generic incoming message listener */
  onMessage(handler: (msg: BotMessage, ctx: BotContext) => Promise<void> | void): void;

  /** Register route command listener (e.g. /start, /weather {city}) */
  onCommand(
    pattern: string,
    handler: (params: Record<string, string>, ctx: BotContext) => Promise<void> | void
  ): void;
}
```

---

## Supported Bot Adapters

| Adapter Package | Target Platform | Connection Method |
|-----------------|-----------------|-------------------|
| `@link-lang/adapter-telegram` | Telegram Bot API | Long Polling / Webhooks |
| `@link-lang/adapter-discord` | Discord Bot API | WebSocket Gateway / REST |
| `@link-lang/adapter-vk` | VK Bot API | Long Poll Server / Callback API |

---

## Multi-Platform Dispatch Lifecycle

1. `channel tg = link telegram("TOKEN")` instantiates `@link-lang/adapter-telegram`.
2. `listen tg, dc { ... }` registers identical `route` and `on message` handlers onto both `tg` and `dc` adapter instances.
3. Incoming events from either platform construct a normalized `BotContext` and trigger the registered handler seamless to Link developer code!
