"use strict";
/**
 * Link Language Event Loop & Event System
 * Manages async events, hooks, channels, timers, and background tasks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLoop = void 0;
class EventLoop {
    eventHandlers = new Map();
    hooks = new Map();
    pendingTasks = [];
    // Register event listener (on message(msg) { ... })
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    // Register lifecycle hook (hook on_start { ... })
    hook(name, handler) {
        if (!this.hooks.has(name)) {
            this.hooks.set(name, []);
        }
        this.hooks.get(name).push(handler);
    }
    // Emit event to all registered listeners
    async emit(event, args = [], contextEnv) {
        const handlers = this.eventHandlers.get(event);
        if (!handlers || handlers.length === 0)
            return;
        for (const handler of handlers) {
            const task = Promise.resolve(handler(args, contextEnv));
            this.pendingTasks.push(task);
            await task;
        }
    }
    // Trigger lifecycle hook
    async triggerHook(name, args = []) {
        const handlers = this.hooks.get(name);
        if (!handlers || handlers.length === 0)
            return;
        for (const handler of handlers) {
            await handler(args);
        }
    }
    // Wait delay (for wait 500ms)
    async wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // Drain pending async tasks
    async drain() {
        while (this.pendingTasks.length > 0) {
            const tasks = [...this.pendingTasks];
            this.pendingTasks = [];
            await Promise.all(tasks);
        }
    }
}
exports.EventLoop = EventLoop;
//# sourceMappingURL=eventloop.js.map