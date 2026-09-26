/**
 * Link Language Event Loop & Event System
 * Manages async events, hooks, channels, timers, and background tasks.
 */

import type { RuntimeValue } from './value.js';
import type { Environment } from './environment.js';

export type EventHandler = (args: RuntimeValue[], contextEnv?: Environment) => Promise<void> | void;
export type HookHandler = (args: RuntimeValue[]) => Promise<void> | void;

export class EventLoop {
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private hooks: Map<string, HookHandler[]> = new Map();
  private pendingTasks: Promise<any>[] = [];

  // Register event listener (on message(msg) { ... })
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  // Register lifecycle hook (hook on_start { ... })
  hook(name: string, handler: HookHandler): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(handler);
  }

  // Emit event to all registered listeners
  async emit(event: string, args: RuntimeValue[] = [], contextEnv?: Environment): Promise<void> {
    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      const task = Promise.resolve(handler(args, contextEnv));
      this.pendingTasks.push(task);
      await task;
    }
  }

  // Trigger lifecycle hook
  async triggerHook(name: string, args: RuntimeValue[] = []): Promise<void> {
    const handlers = this.hooks.get(name);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      await handler(args);
    }
  }

  // Wait delay (for wait 500ms)
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Drain pending async tasks
  async drain(): Promise<void> {
    while (this.pendingTasks.length > 0) {
      const tasks = [...this.pendingTasks];
      this.pendingTasks = [];
      await Promise.all(tasks);
    }
  }
}
