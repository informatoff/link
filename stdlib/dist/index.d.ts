/**
 * Link Standard Library (net, time, json, db, log, crypto)
 */
import { type RuntimeValue, type Environment } from '@link-lang/core';
export declare function registerStdlib(env: Environment): void;
export declare function jsToLinkValue(jsVal: any): RuntimeValue;
export declare function linkValueToJs(val: RuntimeValue): any;
//# sourceMappingURL=index.d.ts.map