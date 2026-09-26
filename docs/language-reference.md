# Link Programming Language Reference

## Overview
**Link** (`.lk`) is a dynamically typed, interpreted programming language specifically designed for building Telegram, Discord, and VK bots, network services, and scripts.

---

## 1. Syntax & Literals

### Variables
- `let` — mutable block-scoped variable
- `const` — immutable block-scoped constant
- `flow` — **Request / Event scoped variable** (automatically deallocated when the handler finishes)

```link
let name = "World"
const PORT = 8080
flow userState = db.get(msg.author_id)
```

### Data Types & Literals
- **Numbers**: `42`, `3.14`
- **Strings**: `"Hello"`, `'World'`, `"Interpolated {name}!"`
- **Booleans**: `true`, `false`
- **Null**: `null`
- **Arrays**: `[1, 2, 3]`
- **Dictionaries**: `{key: "value", age: 25}`
- **Duration Literals**: `500ms`, `5s`, `3m`, `2h`, `1d`, `1w`

---

## 2. Special Language Operators

### 2.1 Retry Operator `~>`
Automatically retries an asynchronous call upon failure with specified retries and delay, eliminating `try/catch` boilerplate.

```link
result = net.get("https://api.example.com/data") ~> retry(3, delay: 500ms)
```

### 2.2 Pipe Operator `|>`
Chains function calls cleanly from left to right.

```link
msg.text |> trim |> lowercase |> send(ctx.chat)
```

---

## 3. Bot & Event Primitives

### 3.1 Event (`event`, `on`, `emit`)
Events are first-class citizens in Link.

```link
event user_joined

on user_joined(user) {
    print("User joined: " + user.name)
}

emit user_joined({name: "Alex"})
```

### 3.2 Channels & Multi-Platform Listeners (`channel`, `listen`)
Unify Telegram, Discord, and VK under a single handler interface.

```link
channel tg = link telegram(env("TG_TOKEN"))
channel dc = link discord(env("DC_TOKEN"))

listen tg, dc {
    route "/start" {
        send(ctx.chat, "Welcome to Link Bot!")
    }

    on message(msg) {
        log.info("Message received: " + msg.text)
    }
}
```

### 3.3 Bot Routes (`route`, `require`)
Syntax-level command parsing, URL parameters, and permission guards.

```link
route "/ban {user} {reason?}" {
    require permission: "admin"
    send(ctx.chat, "Banned: " + user + " (Reason: " + reason + ")")
}
```

### 3.4 Lifecycle Hooks (`hook`)

```link
hook on_start {
    log.info("Bot started successfully!")
}
```

---

## 4. Control Flow & Functions

```link
fn greet(name = "User") {
    return "Hello, " + name
}

if count > 10 {
    print("High count")
} elif count == 5 {
    print("Medium")
} else {
    print("Low")
}

for item in items {
    print(item)
}

while running {
    wait 1s
}
```

---

## 5. Standard Library Modules

- **`net`**: `net.get(url)`, `net.post(url, body)`
- **`db`**: `db.get(key)`, `db.set(key, value)`, `db.has(key)`, `db.delete(key)`
- **`log`**: `log.info(...)`, `log.warn(...)`, `log.error(...)`
- **`time`**: `time.now()`, `time.timestamp()`
- **`json`**: `json.parse(str)`, `json.stringify(obj)`
- **`crypto`**: `crypto.hash(str, algo)`, `crypto.randomToken(bytes)`

## 6. Global Built-in Functions

- `input(prompt)` writes an optional prompt and returns the entered text as a string.
- `int(value)`, `float(value)`, and `str(value)` convert values between common types.

```link
let age = int(input("Age: "))
let height = float(input("Height in meters: "))
print("Age: {age}, height: {height} m")
```
