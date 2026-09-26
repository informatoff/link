# 🔗 Link Programming Language

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/tests-180%20passing-brightgreen.svg)]()

**Link** (`.lk`) is a dynamic, interpreted programming language built from scratch in Node.js/TypeScript. It features first-class language primitives specifically designed for Telegram, Discord, and VK bots, event-driven networking, and backend microservices.

---

## 🚀 Key Features

- **Dynamic & Native Interpretation**: Custom lexer, Pratt parser, AST evaluator, and event loop (no transpilation into JS or Python).
- **First-Class Events (`event`, `on`, `emit`)**: Event driven concurrency in syntax.
- **Unified Multi-Platform Channels (`channel`, `listen`)**: Write ONE handler for Telegram, Discord, and VK simultaneously!
- **Automatic Lifetime Flow Variables (`flow`)**: Context/request-scoped variables that are automatically deallocated when an event or route finishes.
- **Safe Network Retry Operator (`~>`)**: Built-in network auto-retry syntax (`api.fetch(url) ~> retry(3, delay: 500ms)`).
- **Duration Literals**: Time syntax as first-class language tokens (`500ms`, `5s`, `3m`, `2h`, `1d`).
- **Pipe Operator (`|>`)**: Clean left-to-right processing pipelines (`msg.text |> trim |> lowercase`).
- **Bot Route Declarations (`route`)**: Pattern matching command routes with parameter extraction (`/ban {user} {reason?}`) and permission requirements.
- **VS Code Extension & LSP**: Complete syntax highlighting (TextMate), snippets, diagnostics, and autocompletion.

---

## 🛠 Quick Start

### 1. Installation & Build

```bash
# Clone repository
git clone https://github.com/link-lang/link.git
cd link

# Install dependencies and build monorepo
npm install
npm run build
```

For a per-user CLI launcher that adds `link` to `PATH`, see the [installation guide](docs/installation.md). The standalone site is available at [link website]((https://linklang.samp.date/)).

### 2. Run Example Program

```bash
# Execute hello world example
npx link run examples/hello-world.lk

# Run the Telegram shop example (set TG_TOKEN first)
npx link run examples/telegram-shop.lk
```

### 3. Create a New Bot Project

```bash
npx link init my-bot
cd my-bot
npx link run main.lk
```

---

## 💻 Example: Multi-Platform Bot Code

```link
import "telegram"
import "discord"
import "vk"

channel tg = link telegram(env("TG_TOKEN"))
channel dc = link discord(env("DC_TOKEN"))
channel vk = link vk(env("VK_TOKEN"))

// Single handler running on Telegram, Discord, and VK simultaneously!
listen tg, dc, vk {
    route "/start" {
        send(ctx.chat, "Hello from Link Language! 🚀")
    }

    route "/weather {city}" {
        let data = net.get("https://api.weather.com/{city}") ~> retry(3, delay: 500ms)
        send(ctx.chat, "Weather in {city}: {data.temp}°C")
    }

    on message(msg) {
        flow user = db.get(msg.author_id) ?? {msg_count: 0}
        user.msg_count += 1
        db.set(msg.author_id, user)
    }
}

hook on_start {
    log.info("Multi-platform bot started!")
}
```

---

## 📦 Project Monorepo Structure

```
link-lang/
├── packages/
│   ├── core/                 # Lexer, Pratt Parser, AST, Tree-walking Interpreter, CLI
│   ├── stdlib/               # Built-in modules (net, time, json, db, log, crypto)
│   ├── adapters/
│   │   ├── link-telegram/    # Telegram Bot API Adapter
│   │   ├── link-discord/     # Discord Bot Gateway Adapter
│   │   └── link-vk/          # VK Bots API Adapter
│   └── vscode-extension/     # VS Code Extension (Syntax, LSP, Snippets, Icon)
├── examples/
│   ├── hello-world.lk
│   ├── simple-telegram-bot.lk
│   ├── telegram-shop.lk
│   └── multi-platform-bot.lk
├── website/
│   ├── index.html
│   └── downloads/            # Per-user PATH installers for Windows and macOS/Linux
├── docs/
│   ├── installation.md
│   ├── grammar.ebnf
│   ├── language-reference.md
│   └── channel-adapter.md
├── tests/
└── PROGRESS.md
```

---

## 🧪 Testing

Run all unit and integration tests across the monorepo:

```bash
npm run test
```

---

## 📄 License
MIT © Link Language Team
