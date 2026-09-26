"use strict";
/**
 * Link Standard Built-in Global Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupBuiltins = setupBuiltins;
const value_js_1 = require("./value.js");
const node_process_1 = require("node:process");
const promises_1 = require("node:readline/promises");
function setupBuiltins(env) {
    let inputInterface;
    let inputLines;
    // input(prompt) -> string
    env.declareVar('input', (0, value_js_1.makeNativeFn)('input', async (args) => {
        const prompt = args[0] ? (0, value_js_1.stringifyValue)(args[0]) : '';
        inputInterface ??= (0, promises_1.createInterface)({ input: node_process_1.stdin, output: node_process_1.stdout });
        inputLines ??= inputInterface[Symbol.asyncIterator]();
        node_process_1.stdout.write(prompt);
        const line = await inputLines.next();
        if (line.done)
            throw new Error('input() reached end of input');
        return (0, value_js_1.makeString)(line.value);
    }), true, false);
    // print(...)
    env.declareVar('print', (0, value_js_1.makeNativeFn)('print', (args) => {
        const output = args.map(value_js_1.stringifyValue).join(' ');
        console.log(output);
        return value_js_1.NULL_VAL;
    }), true, false);
    // len(item)
    env.declareVar('len', (0, value_js_1.makeNativeFn)('len', (args) => {
        const target = args[0];
        if (!target)
            return (0, value_js_1.makeNumber)(0);
        if (target.type === 'string')
            return (0, value_js_1.makeNumber)(target.value.length);
        if (target.type === 'array')
            return (0, value_js_1.makeNumber)(target.elements.length);
        if (target.type === 'dict')
            return (0, value_js_1.makeNumber)(target.entries.size);
        throw new Error(`len() is not supported for type '${target.type}'`);
    }), true, false);
    // type(val)
    env.declareVar('type', (0, value_js_1.makeNativeFn)('type', (args) => {
        const val = args[0];
        return (0, value_js_1.makeString)(val ? val.type : 'null');
    }), true, false);
    // range(start, end, step)
    env.declareVar('range', (0, value_js_1.makeNativeFn)('range', (args) => {
        let start = 0;
        let end = 0;
        let step = 1;
        if (args.length === 1 && args[0].type === 'number') {
            end = args[0].value;
        }
        else if (args.length >= 2 && args[0].type === 'number' && args[1].type === 'number') {
            start = args[0].value;
            end = args[1].value;
            if (args[2] && args[2].type === 'number')
                step = args[2].value;
        }
        const res = [];
        if (step > 0) {
            for (let i = start; i < end; i += step)
                res.push((0, value_js_1.makeNumber)(i));
        }
        else if (step < 0) {
            for (let i = start; i > end; i += step)
                res.push((0, value_js_1.makeNumber)(i));
        }
        return (0, value_js_1.makeArray)(res);
    }), true, false);
    // env("VAR_NAME", defaultVal)
    env.declareVar('env', (0, value_js_1.makeNativeFn)('env', (args) => {
        const key = args[0]?.type === 'string' ? args[0].value : '';
        const val = process.env[key];
        if (val !== undefined)
            return (0, value_js_1.makeString)(val);
        return args[1] ?? value_js_1.NULL_VAL;
    }), true, false);
    // str(val)
    env.declareVar('str', (0, value_js_1.makeNativeFn)('str', (args) => {
        return (0, value_js_1.makeString)(args[0] ? (0, value_js_1.stringifyValue)(args[0]) : '');
    }), true, false);
    // int(val)
    env.declareVar('int', (0, value_js_1.makeNativeFn)('int', (args) => {
        const val = args[0];
        if (!val)
            return (0, value_js_1.makeNumber)(0);
        if (val.type === 'number')
            return (0, value_js_1.makeNumber)(Math.floor(val.value));
        if (val.type === 'string')
            return (0, value_js_1.makeNumber)(parseInt(val.value, 10) || 0);
        return (0, value_js_1.makeNumber)(0);
    }), true, false);
    // float(val)
    env.declareVar('float', (0, value_js_1.makeNativeFn)('float', (args) => {
        const val = args[0];
        if (!val)
            return (0, value_js_1.makeNumber)(0);
        if (val.type === 'number')
            return (0, value_js_1.makeNumber)(val.value);
        if (val.type === 'string')
            return (0, value_js_1.makeNumber)(parseFloat(val.value) || 0);
        return (0, value_js_1.makeNumber)(0);
    }), true, false);
    // send(chat, message) — mock built-in for bot routing test
    env.declareVar('send', (0, value_js_1.makeNativeFn)('send', (args) => {
        const target = (0, value_js_1.stringifyValue)(args[0] ?? value_js_1.NULL_VAL);
        const msg = (0, value_js_1.stringifyValue)(args[1] ?? value_js_1.NULL_VAL);
        console.log(`[SEND to ${target}] ${msg}`);
        return value_js_1.NULL_VAL;
    }), true, false);
    return () => {
        inputInterface?.close();
        inputInterface = undefined;
        inputLines = undefined;
    };
}
//# sourceMappingURL=builtins.js.map