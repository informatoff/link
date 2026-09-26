/**
 * Link Standard Library (net, time, json, db, log, crypto)
 */

import {
  type RuntimeValue,
  type DictValue,
  makeDict,
  makeNativeFn,
  makeString,
  makeNumber,
  makeBool,
  makeArray,
  NULL_VAL,
  stringifyValue,
  type Environment,
} from '@link-lang/core';
import * as cryptoModule from 'crypto';

// In-memory key-value database state
const dbStore = new Map<string, RuntimeValue>();

export function registerStdlib(env: Environment): void {
  // ─── log module ─────────────────────────────────────────────────────────────
  const logEntries = new Map<string, RuntimeValue>();
  logEntries.set('info', makeNativeFn('log.info', (args) => {
    console.log(`[INFO] ${args.map(stringifyValue).join(' ')}`);
    return NULL_VAL;
  }));
  logEntries.set('warn', makeNativeFn('log.warn', (args) => {
    console.warn(`[WARN] ${args.map(stringifyValue).join(' ')}`);
    return NULL_VAL;
  }));
  logEntries.set('error', makeNativeFn('log.error', (args) => {
    console.error(`[ERROR] ${args.map(stringifyValue).join(' ')}`);
    return NULL_VAL;
  }));
  logEntries.set('debug', makeNativeFn('log.debug', (args) => {
    console.debug(`[DEBUG] ${args.map(stringifyValue).join(' ')}`);
    return NULL_VAL;
  }));
  env.declareVar('log', makeDict(logEntries), true, false);

  // ─── net module ─────────────────────────────────────────────────────────────
  const netEntries = new Map<string, RuntimeValue>();
  netEntries.set('get', makeNativeFn('net.get', async (args) => {
    const url = stringifyValue(args[0] ?? NULL_VAL);
    try {
      const res = await fetch(url);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return jsToLinkValue(json);
      } catch {
        return makeString(text);
      }
    } catch (e: any) {
      throw new Error(`net.get failed for ${url}: ${e.message}`);
    }
  }));

  netEntries.set('post', makeNativeFn('net.post', async (args) => {
    const url = stringifyValue(args[0] ?? NULL_VAL);
    const bodyVal = args[1] ?? NULL_VAL;
    const bodyStr = typeof bodyVal === 'object' && bodyVal.type === 'dict'
      ? JSON.stringify(linkValueToJs(bodyVal))
      : stringifyValue(bodyVal);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
      const text = await res.text();
      try {
        return jsToLinkValue(JSON.parse(text));
      } catch {
        return makeString(text);
      }
    } catch (e: any) {
      throw new Error(`net.post failed for ${url}: ${e.message}`);
    }
  }));

  env.declareVar('net', makeDict(netEntries), true, false);

  // ─── time module ────────────────────────────────────────────────────────────
  const timeEntries = new Map<string, RuntimeValue>();
  timeEntries.set('now', makeNativeFn('time.now', () => {
    return makeString(new Date().toISOString());
  }));
  timeEntries.set('timestamp', makeNativeFn('time.timestamp', () => {
    return makeNumber(Date.now());
  }));
  env.declareVar('time', makeDict(timeEntries), true, false);

  // ─── json module ────────────────────────────────────────────────────────────
  const jsonEntries = new Map<string, RuntimeValue>();
  jsonEntries.set('parse', makeNativeFn('json.parse', (args) => {
    const str = stringifyValue(args[0] ?? NULL_VAL);
    return jsToLinkValue(JSON.parse(str));
  }));
  jsonEntries.set('stringify', makeNativeFn('json.stringify', (args) => {
    const jsObj = linkValueToJs(args[0] ?? NULL_VAL);
    return makeString(JSON.stringify(jsObj));
  }));
  env.declareVar('json', makeDict(jsonEntries), true, false);

  // ─── db module (KV Store / Database adapter) ────────────────────────────────
  const dbEntries = new Map<string, RuntimeValue>();
  dbEntries.set('get', makeNativeFn('db.get', (args) => {
    const key = stringifyValue(args[0] ?? NULL_VAL);
    return dbStore.get(key) ?? NULL_VAL;
  }));
  dbEntries.set('set', makeNativeFn('db.set', (args) => {
    const key = stringifyValue(args[0] ?? NULL_VAL);
    const val = args[1] ?? NULL_VAL;
    dbStore.set(key, val);
    return val;
  }));
  dbEntries.set('has', makeNativeFn('db.has', (args) => {
    const key = stringifyValue(args[0] ?? NULL_VAL);
    return makeBool(dbStore.has(key));
  }));
  dbEntries.set('delete', makeNativeFn('db.delete', (args) => {
    const key = stringifyValue(args[0] ?? NULL_VAL);
    const had = dbStore.has(key);
    dbStore.delete(key);
    return makeBool(had);
  }));
  env.declareVar('db', makeDict(dbEntries), true, false);

  // ─── crypto module ──────────────────────────────────────────────────────────
  const cryptoEntries = new Map<string, RuntimeValue>();
  cryptoEntries.set('hash', makeNativeFn('crypto.hash', (args) => {
    const str = stringifyValue(args[0] ?? NULL_VAL);
    const algo = args[1]?.type === 'string' ? args[1].value : 'sha256';
    const hash = cryptoModule.createHash(algo).update(str).digest('hex');
    return makeString(hash);
  }));
  cryptoEntries.set('randomToken', makeNativeFn('crypto.randomToken', (args) => {
    const bytes = args[0]?.type === 'number' ? args[0].value : 16;
    return makeString(cryptoModule.randomBytes(bytes).toString('hex'));
  }));
  env.declareVar('crypto', makeDict(cryptoEntries), true, false);
}

// ─── Helper conversions ───────────────────────────────────────────────────────

export function jsToLinkValue(jsVal: any): RuntimeValue {
  if (jsVal === null || jsVal === undefined) return NULL_VAL;
  if (typeof jsVal === 'boolean') return makeBool(jsVal);
  if (typeof jsVal === 'number') return makeNumber(jsVal);
  if (typeof jsVal === 'string') return makeString(jsVal);
  if (Array.isArray(jsVal)) return makeArray(jsVal.map(jsToLinkValue));
  if (typeof jsVal === 'object') {
    const map = new Map<string, RuntimeValue>();
    for (const k of Object.keys(jsVal)) {
      map.set(k, jsToLinkValue(jsVal[k]));
    }
    return makeDict(map);
  }
  return NULL_VAL;
}

export function linkValueToJs(val: RuntimeValue): any {
  switch (val.type) {
    case 'null': return null;
    case 'boolean': return val.value;
    case 'number': return val.value;
    case 'string': return val.value;
    case 'duration': return val.ms;
    case 'array': return val.elements.map(linkValueToJs);
    case 'dict': {
      const obj: Record<string, any> = {};
      for (const [k, v] of val.entries.entries()) {
        obj[k] = linkValueToJs(v);
      }
      return obj;
    }
    default: return null;
  }
}
