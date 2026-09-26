"use strict";
/**
 * Link Language Runtime Values
 * Representation of runtime values in Link VM / Interpreter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALSE_VAL = exports.TRUE_VAL = exports.NULL_VAL = void 0;
exports.makeBool = makeBool;
exports.makeNumber = makeNumber;
exports.makeString = makeString;
exports.makeDuration = makeDuration;
exports.makeArray = makeArray;
exports.makeDict = makeDict;
exports.makeNativeFn = makeNativeFn;
exports.jsToLinkValue = jsToLinkValue;
exports.stringifyValue = stringifyValue;
exports.isTruthy = isTruthy;
// ─── Value Constructors ──────────────────────────────────────────────────────
exports.NULL_VAL = { type: 'null', value: null };
exports.TRUE_VAL = { type: 'boolean', value: true };
exports.FALSE_VAL = { type: 'boolean', value: false };
function makeBool(val) {
    return val ? exports.TRUE_VAL : exports.FALSE_VAL;
}
function makeNumber(val) {
    return { type: 'number', value: val };
}
function makeString(val) {
    return { type: 'string', value: val };
}
function makeDuration(amount, unit, ms) {
    return { type: 'duration', amount, unit, ms };
}
function makeArray(elements = []) {
    return { type: 'array', elements };
}
function makeDict(entries = new Map()) {
    return { type: 'dict', entries };
}
function makeNativeFn(name, fn) {
    return { type: 'native_function', name, fn };
}
function jsToLinkValue(jsVal) {
    if (jsVal === null || jsVal === undefined)
        return exports.NULL_VAL;
    if (typeof jsVal === 'boolean')
        return makeBool(jsVal);
    if (typeof jsVal === 'number')
        return makeNumber(jsVal);
    if (typeof jsVal === 'string')
        return makeString(jsVal);
    if (Array.isArray(jsVal))
        return makeArray(jsVal.map(jsToLinkValue));
    if (typeof jsVal === 'object') {
        const map = new Map();
        for (const k of Object.keys(jsVal)) {
            map.set(k, jsToLinkValue(jsVal[k]));
        }
        return makeDict(map);
    }
    return exports.NULL_VAL;
}
// ─── Value Stringifying / Display ────────────────────────────────────────────
function stringifyValue(val) {
    switch (val.type) {
        case 'null': return 'null';
        case 'boolean': return String(val.value);
        case 'number': return String(val.value);
        case 'string': return val.value;
        case 'duration': return `${val.amount}${val.unit}`;
        case 'array':
            return `[${val.elements.map(stringifyValue).join(', ')}]`;
        case 'dict': {
            const items = [];
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
function isTruthy(val) {
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
//# sourceMappingURL=value.js.map