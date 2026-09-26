/**
 * Link Language Runtime Values
 * Representation of runtime values in Link VM / Interpreter.
 */

import type { FnDecl, Block, Param, LambdaExpr } from '../ast/index.js';
import type { Environment } from './environment.js';

export type ValueType =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'duration'
  | 'array'
  | 'dict'
  | 'function'
  | 'native_function'
  | 'event'
  | 'channel';

export interface BaseValue {
  type: ValueType;
}

export interface NullValue extends BaseValue {
  type: 'null';
  value: null;
}

export interface BooleanValue extends BaseValue {
  type: 'boolean';
  value: boolean;
}

export interface NumberValue extends BaseValue {
  type: 'number';
  value: number;
}

export interface StringValue extends BaseValue {
  type: 'string';
  value: string;
}

export interface DurationValue extends BaseValue {
  type: 'duration';
  amount: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w';
  ms: number;
}

export interface ArrayValue extends BaseValue {
  type: 'array';
  elements: RuntimeValue[];
}

export interface DictValue extends BaseValue {
  type: 'dict';
  entries: Map<string, RuntimeValue>;
}

export interface FunctionValue extends BaseValue {
  type: 'function';
  name: string;
  params: Param[];
  body: Block | any; // Expression or Block
  closure: Environment;
  isAsync: boolean;
}

export type NativeFn = (args: RuntimeValue[], env: Environment) => Promise<RuntimeValue> | RuntimeValue;

export interface NativeFunctionValue extends BaseValue {
  type: 'native_function';
  name: string;
  fn: NativeFn;
}

export interface EventValue extends BaseValue {
  type: 'event';
  name: string;
}

export interface ChannelValue extends BaseValue {
  type: 'channel';
  name: string;
  platform: string;
  token: string;
  adapter?: any;
}

export type RuntimeValue =
  | NullValue
  | BooleanValue
  | NumberValue
  | StringValue
  | DurationValue
  | ArrayValue
  | DictValue
  | FunctionValue
  | NativeFunctionValue
  | EventValue
  | ChannelValue;

// ─── Value Constructors ──────────────────────────────────────────────────────

export const NULL_VAL: NullValue = { type: 'null', value: null };
export const TRUE_VAL: BooleanValue = { type: 'boolean', value: true };
export const FALSE_VAL: BooleanValue = { type: 'boolean', value: false };

export function makeBool(val: boolean): BooleanValue {
  return val ? TRUE_VAL : FALSE_VAL;
}

export function makeNumber(val: number): NumberValue {
  return { type: 'number', value: val };
}

export function makeString(val: string): StringValue {
  return { type: 'string', value: val };
}

export function makeDuration(amount: number, unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w', ms: number): DurationValue {
  return { type: 'duration', amount, unit, ms };
}

export function makeArray(elements: RuntimeValue[] = []): ArrayValue {
  return { type: 'array', elements };
}

export function makeDict(entries: Map<string, RuntimeValue> = new Map()): DictValue {
  return { type: 'dict', entries };
}

export function makeNativeFn(name: string, fn: NativeFn): NativeFunctionValue {
  return { type: 'native_function', name, fn };
}

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

// ─── Value Stringifying / Display ────────────────────────────────────────────

export function stringifyValue(val: RuntimeValue): string {
  switch (val.type) {
    case 'null': return 'null';
    case 'boolean': return String(val.value);
    case 'number': return String(val.value);
    case 'string': return val.value;
    case 'duration': return `${val.amount}${val.unit}`;
    case 'array':
      return `[${val.elements.map(stringifyValue).join(', ')}]`;
    case 'dict': {
      const items: string[] = [];
      for (const [k, v] of val.entries.entries()) {
        items.push(`${k}: ${stringifyValue(v)}`);
      }
      return `{${items.join(', ')}}`;
    }
    case 'function': return `<fn ${val.name}>`;
    case 'native_function': return `<native fn ${val.name}>`;
    case 'event': return `<event ${val.name}>`;
    case 'channel': return `<channel ${val.name}:${val.platform}>`;
  }
}

export function isTruthy(val: RuntimeValue): boolean {
  switch (val.type) {
    case 'null': return false;
    case 'boolean': return val.value;
    case 'number': return val.value !== 0;
    case 'string': return val.value.length > 0;
    case 'array': return val.elements.length > 0;
    case 'dict': return val.entries.size > 0;
    default: return true;
  }
}
