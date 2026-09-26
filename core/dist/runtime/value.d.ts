/**
 * Link Language Runtime Values
 * Representation of runtime values in Link VM / Interpreter.
 */
import type { Block, Param } from '../ast/index.js';
import type { Environment } from './environment.js';
export type ValueType = 'null' | 'boolean' | 'number' | 'string' | 'duration' | 'array' | 'dict' | 'function' | 'native_function' | 'event' | 'channel';
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
    body: Block | any;
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
export type RuntimeValue = NullValue | BooleanValue | NumberValue | StringValue | DurationValue | ArrayValue | DictValue | FunctionValue | NativeFunctionValue | EventValue | ChannelValue;
export declare const NULL_VAL: NullValue;
export declare const TRUE_VAL: BooleanValue;
export declare const FALSE_VAL: BooleanValue;
export declare function makeBool(val: boolean): BooleanValue;
export declare function makeNumber(val: number): NumberValue;
export declare function makeString(val: string): StringValue;
export declare function makeDuration(amount: number, unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w', ms: number): DurationValue;
export declare function makeArray(elements?: RuntimeValue[]): ArrayValue;
export declare function makeDict(entries?: Map<string, RuntimeValue>): DictValue;
export declare function makeNativeFn(name: string, fn: NativeFn): NativeFunctionValue;
export declare function jsToLinkValue(jsVal: any): RuntimeValue;
export declare function stringifyValue(val: RuntimeValue): string;
export declare function isTruthy(val: RuntimeValue): boolean;
//# sourceMappingURL=value.d.ts.map