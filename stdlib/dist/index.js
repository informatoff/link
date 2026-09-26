"use strict";
/**
 * Link Standard Library (net, time, json, db, log, crypto)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStdlib = registerStdlib;
exports.jsToLinkValue = jsToLinkValue;
exports.linkValueToJs = linkValueToJs;
const core_1 = require("@link-lang/core");
const cryptoModule = __importStar(require("crypto"));
// In-memory key-value database state
const dbStore = new Map();
function registerStdlib(env) {
    // ─── log module ─────────────────────────────────────────────────────────────
    const logEntries = new Map();
    logEntries.set('info', (0, core_1.makeNativeFn)('log.info', (args) => {
        console.log(`[INFO] ${args.map(core_1.stringifyValue).join(' ')}`);
        return core_1.NULL_VAL;
    }));
    logEntries.set('warn', (0, core_1.makeNativeFn)('log.warn', (args) => {
        console.warn(`[WARN] ${args.map(core_1.stringifyValue).join(' ')}`);
        return core_1.NULL_VAL;
    }));
    logEntries.set('error', (0, core_1.makeNativeFn)('log.error', (args) => {
        console.error(`[ERROR] ${args.map(core_1.stringifyValue).join(' ')}`);
        return core_1.NULL_VAL;
    }));
    logEntries.set('debug', (0, core_1.makeNativeFn)('log.debug', (args) => {
        console.debug(`[DEBUG] ${args.map(core_1.stringifyValue).join(' ')}`);
        return core_1.NULL_VAL;
    }));
    env.declareVar('log', (0, core_1.makeDict)(logEntries), true, false);
    // ─── net module ─────────────────────────────────────────────────────────────
    const netEntries = new Map();
    netEntries.set('get', (0, core_1.makeNativeFn)('net.get', async (args) => {
        const url = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        try {
            const res = await fetch(url);
            const text = await res.text();
            try {
                const json = JSON.parse(text);
                return jsToLinkValue(json);
            }
            catch {
                return (0, core_1.makeString)(text);
            }
        }
        catch (e) {
            throw new Error(`net.get failed for ${url}: ${e.message}`);
        }
    }));
    netEntries.set('post', (0, core_1.makeNativeFn)('net.post', async (args) => {
        const url = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        const bodyVal = args[1] ?? core_1.NULL_VAL;
        const bodyStr = typeof bodyVal === 'object' && bodyVal.type === 'dict'
            ? JSON.stringify(linkValueToJs(bodyVal))
            : (0, core_1.stringifyValue)(bodyVal);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr,
            });
            const text = await res.text();
            try {
                return jsToLinkValue(JSON.parse(text));
            }
            catch {
                return (0, core_1.makeString)(text);
            }
        }
        catch (e) {
            throw new Error(`net.post failed for ${url}: ${e.message}`);
        }
    }));
    env.declareVar('net', (0, core_1.makeDict)(netEntries), true, false);
    // ─── time module ────────────────────────────────────────────────────────────
    const timeEntries = new Map();
    timeEntries.set('now', (0, core_1.makeNativeFn)('time.now', () => {
        return (0, core_1.makeString)(new Date().toISOString());
    }));
    timeEntries.set('timestamp', (0, core_1.makeNativeFn)('time.timestamp', () => {
        return (0, core_1.makeNumber)(Date.now());
    }));
    env.declareVar('time', (0, core_1.makeDict)(timeEntries), true, false);
    // ─── json module ────────────────────────────────────────────────────────────
    const jsonEntries = new Map();
    jsonEntries.set('parse', (0, core_1.makeNativeFn)('json.parse', (args) => {
        const str = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        return jsToLinkValue(JSON.parse(str));
    }));
    jsonEntries.set('stringify', (0, core_1.makeNativeFn)('json.stringify', (args) => {
        const jsObj = linkValueToJs(args[0] ?? core_1.NULL_VAL);
        return (0, core_1.makeString)(JSON.stringify(jsObj));
    }));
    env.declareVar('json', (0, core_1.makeDict)(jsonEntries), true, false);
    // ─── db module (KV Store / Database adapter) ────────────────────────────────
    const dbEntries = new Map();
    dbEntries.set('get', (0, core_1.makeNativeFn)('db.get', (args) => {
        const key = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        return dbStore.get(key) ?? core_1.NULL_VAL;
    }));
    dbEntries.set('set', (0, core_1.makeNativeFn)('db.set', (args) => {
        const key = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        const val = args[1] ?? core_1.NULL_VAL;
        dbStore.set(key, val);
        return val;
    }));
    dbEntries.set('has', (0, core_1.makeNativeFn)('db.has', (args) => {
        const key = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        return (0, core_1.makeBool)(dbStore.has(key));
    }));
    dbEntries.set('delete', (0, core_1.makeNativeFn)('db.delete', (args) => {
        const key = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        const had = dbStore.has(key);
        dbStore.delete(key);
        return (0, core_1.makeBool)(had);
    }));
    env.declareVar('db', (0, core_1.makeDict)(dbEntries), true, false);
    // ─── crypto module ──────────────────────────────────────────────────────────
    const cryptoEntries = new Map();
    cryptoEntries.set('hash', (0, core_1.makeNativeFn)('crypto.hash', (args) => {
        const str = (0, core_1.stringifyValue)(args[0] ?? core_1.NULL_VAL);
        const algo = args[1]?.type === 'string' ? args[1].value : 'sha256';
        const hash = cryptoModule.createHash(algo).update(str).digest('hex');
        return (0, core_1.makeString)(hash);
    }));
    cryptoEntries.set('randomToken', (0, core_1.makeNativeFn)('crypto.randomToken', (args) => {
        const bytes = args[0]?.type === 'number' ? args[0].value : 16;
        return (0, core_1.makeString)(cryptoModule.randomBytes(bytes).toString('hex'));
    }));
    env.declareVar('crypto', (0, core_1.makeDict)(cryptoEntries), true, false);
}
// ─── Helper conversions ───────────────────────────────────────────────────────
function jsToLinkValue(jsVal) {
    if (jsVal === null || jsVal === undefined)
        return core_1.NULL_VAL;
    if (typeof jsVal === 'boolean')
        return (0, core_1.makeBool)(jsVal);
    if (typeof jsVal === 'number')
        return (0, core_1.makeNumber)(jsVal);
    if (typeof jsVal === 'string')
        return (0, core_1.makeString)(jsVal);
    if (Array.isArray(jsVal))
        return (0, core_1.makeArray)(jsVal.map(jsToLinkValue));
    if (typeof jsVal === 'object') {
        const map = new Map();
        for (const k of Object.keys(jsVal)) {
            map.set(k, jsToLinkValue(jsVal[k]));
        }
        return (0, core_1.makeDict)(map);
    }
    return core_1.NULL_VAL;
}
function linkValueToJs(val) {
    switch (val.type) {
        case 'null': return null;
        case 'boolean': return val.value;
        case 'number': return val.value;
        case 'string': return val.value;
        case 'duration': return val.ms;
        case 'array': return val.elements.map(linkValueToJs);
        case 'dict': {
            const obj = {};
            for (const [k, v] of val.entries.entries()) {
                obj[k] = linkValueToJs(v);
            }
            return obj;
        }
        default: return null;
    }
}
//# sourceMappingURL=index.js.map