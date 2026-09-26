/**
 * Link Standard Built-in Global Functions
 */

import {
  type RuntimeValue,
  type NativeFunctionValue,
  makeNativeFn,
  makeNumber,
  makeString,
  makeArray,
  NULL_VAL,
  stringifyValue,
  makeBool,
} from './value.js';
import type { Environment } from './environment.js';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export function setupBuiltins(env: Environment): () => void {
  let inputInterface: ReturnType<typeof createInterface> | undefined;
  let inputLines: AsyncIterator<string> | undefined;

  // input(prompt) -> string
  env.declareVar('input', makeNativeFn('input', async (args) => {
    const prompt = args[0] ? stringifyValue(args[0]) : '';
    inputInterface ??= createInterface({ input: stdin, output: stdout });
    inputLines ??= inputInterface[Symbol.asyncIterator]();
    stdout.write(prompt);
    const line = await inputLines.next();
    if (line.done) throw new Error('input() reached end of input');
    return makeString(line.value);
  }), true, false);

  // print(...)
  env.declareVar('print', makeNativeFn('print', (args) => {
    const output = args.map(stringifyValue).join(' ');
    console.log(output);
    return NULL_VAL;
  }), true, false);

  // len(item)
  env.declareVar('len', makeNativeFn('len', (args) => {
    const target = args[0];
    if (!target) return makeNumber(0);
    if (target.type === 'string') return makeNumber(target.value.length);
    if (target.type === 'array') return makeNumber(target.elements.length);
    if (target.type === 'dict') return makeNumber(target.entries.size);
    throw new Error(`len() is not supported for type '${target.type}'`);
  }), true, false);

  // type(val)
  env.declareVar('type', makeNativeFn('type', (args) => {
    const val = args[0];
    return makeString(val ? val.type : 'null');
  }), true, false);

  // range(start, end, step)
  env.declareVar('range', makeNativeFn('range', (args) => {
    let start = 0;
    let end = 0;
    let step = 1;

    if (args.length === 1 && args[0].type === 'number') {
      end = args[0].value;
    } else if (args.length >= 2 && args[0].type === 'number' && args[1].type === 'number') {
      start = args[0].value;
      end = args[1].value;
      if (args[2] && args[2].type === 'number') step = args[2].value;
    }

    const res: RuntimeValue[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) res.push(makeNumber(i));
    } else if (step < 0) {
      for (let i = start; i > end; i += step) res.push(makeNumber(i));
    }
    return makeArray(res);
  }), true, false);

  // env("VAR_NAME", defaultVal)
  env.declareVar('env', makeNativeFn('env', (args) => {
    const key = args[0]?.type === 'string' ? args[0].value : '';
    const val = process.env[key];
    if (val !== undefined) return makeString(val);
    return args[1] ?? NULL_VAL;
  }), true, false);

  // str(val)
  env.declareVar('str', makeNativeFn('str', (args) => {
    return makeString(args[0] ? stringifyValue(args[0]) : '');
  }), true, false);

  // int(val)
  env.declareVar('int', makeNativeFn('int', (args) => {
    const val = args[0];
    if (!val) return makeNumber(0);
    if (val.type === 'number') return makeNumber(Math.floor(val.value));
    if (val.type === 'string') return makeNumber(parseInt(val.value, 10) || 0);
    return makeNumber(0);
  }), true, false);

  // float(val)
  env.declareVar('float', makeNativeFn('float', (args) => {
    const val = args[0];
    if (!val) return makeNumber(0);
    if (val.type === 'number') return makeNumber(val.value);
    if (val.type === 'string') return makeNumber(parseFloat(val.value) || 0);
    return makeNumber(0);
  }), true, false);

  // send(chat, message) — mock built-in for bot routing test
  env.declareVar('send', makeNativeFn('send', (args) => {
    const target = stringifyValue(args[0] ?? NULL_VAL);
    const msg = stringifyValue(args[1] ?? NULL_VAL);
    console.log(`[SEND to ${target}] ${msg}`);
    return NULL_VAL;
  }), true, false);

  return () => {
    inputInterface?.close();
    inputInterface = undefined;
    inputLines = undefined;
  };
}
