import { describe, it, expect, vi } from 'vitest';
import { Interpreter } from '../src/runtime/interpreter.js';
import { makeNumber, makeString, NULL_VAL } from '../src/runtime/value.js';
import { registerAdapterFactory, type BotContext, type BotMessage, type IChannelAdapter } from '../src/runtime/adapters.js';
import { parse } from '../src/parser/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Link Interpreter', () => {
  it('executes basic arithmetic and variable assignment', async () => {
    const interpreter = new Interpreter();
    const result = await interpreter.run(`
      let a = 10
      let b = 20
      let c = a + b * 2
      c
    `);
    expect(result).toEqual(makeNumber(50));
  });

  it('executes hello-world.lk example without errors', async () => {
    const filePath = path.resolve(__dirname, '../../../examples/hello-world.lk');
    const src = fs.readFileSync(filePath, 'utf-8');
    const interpreter = new Interpreter();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await interpreter.run(src, filePath);

    expect(consoleSpy).toHaveBeenCalledWith('Hello, World! Link v1');
    expect(consoleSpy).toHaveBeenCalledWith('Link runtime started!');
    consoleSpy.mockRestore();
  });

  it('executes pipe operator |>', async () => {
    const interpreter = new Interpreter();
    const result = await interpreter.run(`
      fn addOne(x) { return x + 1 }
      fn double(x) { return x * 2 }
      5 |> addOne |> double
    `);
    expect(result).toEqual(makeNumber(12));
  });

  it('executes event emit and handler', async () => {
    const interpreter = new Interpreter();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await interpreter.run(`
      event user_joined

      on user_joined(user) {
        print("User joined: " + user)
      }

      emit user_joined("Alex")
    `);

    expect(consoleSpy).toHaveBeenCalledWith('User joined: Alex');
    consoleSpy.mockRestore();
  });

  it('sends from a channel message handler with Markdown options', async () => {
    let messageHandler: ((message: BotMessage, context: BotContext) => Promise<void> | void) | undefined;
    const sendMessage = vi.fn(async () => {});
    const adapter: IChannelAdapter = {
      platform: 'telegram',
      token: 'test-token',
      connect: async () => {},
      disconnect: async () => {},
      sendMessage,
      onMessage(handler) {
        messageHandler = handler;
      },
      onCommand() {},
    };
    registerAdapterFactory('telegram', () => adapter);

    const interpreter = new Interpreter();
    await interpreter.evaluateProgram(parse(`
      channel tg = link telegram("test-token")
      listen tg {
        on message(msg) {
          send(msg.chatId, "*{msg.text}*", {parse_mode: "Markdown"})
        }
      }
    `));

    if (!messageHandler) throw new Error('Message handler was not registered');
    const message: BotMessage = {
      id: '1',
      chatId: '42',
      authorId: '7',
      authorName: 'Alex',
      text: 'Hello',
      platform: 'telegram',
      rawPayload: {},
    };
    await messageHandler(message, {
      chat: '42',
      user: '7',
      channelName: 'tg',
      platform: 'telegram',
      message,
    });

    expect(sendMessage).toHaveBeenCalledWith('42', '*Hello*', { parse_mode: 'Markdown' });
  });

  it('handles flow variables scoped to handler', async () => {
    const interpreter = new Interpreter();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await interpreter.run(`
      event test_event

      on test_event(val) {
        flow temp = val + 100
        print("Temp: " + temp)
      }

      emit test_event(5)
    `);

    expect(consoleSpy).toHaveBeenCalledWith('Temp: 105');
    consoleSpy.mockRestore();
  });

  it('executes retry operator ~> with delay', async () => {
    const interpreter = new Interpreter();
    let attempts = 0;

    interpreter.globalEnv.declareVar('flakyCall', {
      type: 'native_function',
      name: 'flakyCall',
      fn: () => {
        attempts++;
        if (attempts < 3) throw new Error('Network timeout');
        return makeString('Success');
      },
    }, true, false);

    const result = await interpreter.run(`
      flakyCall() ~> retry(3, delay: 10ms)
    `);

    expect(result).toEqual(makeString('Success'));
    expect(attempts).toBe(3);
  });
});
