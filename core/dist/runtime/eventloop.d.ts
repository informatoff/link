/**
 * Link Language Event Loop & Event System
 * Manages async events, hooks, channels, timers, and background tasks.
 */
import type { RuntimeValue } from './value.js';
import type { Environment } from './environment.js';
export type EventHandler = (args: RuntimeValue[], contextEnv?: Environment) => Promise<void> | void;
export type HookHandler = (args: RuntimeValue[]) => Promise<void> | void;
export declare class EventLoop {
    private eventHandlers;
    private hooks;
    private pendingTasks;
    on(event: string, handler: EventHandler): void;
    hook(name: string, handler: HookHandler): void;
    emit(event: string, args?: RuntimeValue[], contextEnv?: Environment): Promise<void>;
    triggerHook(name: string, args?: RuntimeValue[]): Promise<void>;
    wait(ms: number): Promise<void>;
    drain(): Promise<void>;
}
//# sourceMappingURL=eventloop.d.ts.map