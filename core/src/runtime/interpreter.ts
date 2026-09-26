/**
 * Link Language Tree-Walking Interpreter
 * Executes Link AST nodes with full async, event loop, and flow variable support.
 */

import type {
  Program,
  Statement,
  Expression,
  Block,
  VarDecl,
  FnDecl,
  IfStmt,
  ForStmt,
  WhileStmt,
  LoopStmt,
  TryStmt,
  ReturnStmt,
  BreakStmt,
  ContinueStmt,
  EventDecl,
  ChannelDecl,
  ListenStmt,
  OnStmt,
  RouteStmt,
  HookStmt,
  EmitStmt,
  WaitStmt,
  BinaryExpr,
  UnaryExpr,
  AssignExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  LambdaExpr,
  PipeExpr,
  RetryExpr,
  AwaitExpr,
  TernaryExpr,
  TemplateLiteral,
  DictLiteral,
  ArrayLiteral,
  DurationLiteral,
} from '../ast/index.js';

import {
  type RuntimeValue,
  type FunctionValue,
  type DictValue,
  type ArrayValue,
  type EventValue,
  type ChannelValue,
  NULL_VAL,
  makeNumber,
  makeString,
  makeBool,
  makeArray,
  makeDict,
  makeDuration,
  makeNativeFn,
  jsToLinkValue,
  isTruthy,
  stringifyValue,
} from './value.js';

import { Environment } from './environment.js';
import { EventLoop } from './eventloop.js';
import { setupBuiltins } from './builtins.js';
import { createAdapter, type IChannelAdapter } from './adapters.js';

function runtimeValueToJS(value: RuntimeValue): unknown {
  switch (value.type) {
    case 'null': return null;
    case 'boolean':
    case 'number':
    case 'string': return value.value;
    case 'duration': return value.ms;
    case 'array': return value.elements.map(runtimeValueToJS);
    case 'dict':
      return Object.fromEntries(
        Array.from(value.entries, ([key, entry]) => [key, runtimeValueToJS(entry)])
      );
    default: return null;
  }
}
import { parse } from '../parser/index.js';

export class ReturnControl {
  constructor(public readonly value: RuntimeValue) {}
}

export class BreakControl {}
export class ContinueControl {}

export class Interpreter {
  public globalEnv: Environment;
  public eventLoop: EventLoop;
  private routes: RouteStmt[] = [];
  public hasActiveListeners = false;

  constructor() {
    this.globalEnv = new Environment();
    this.eventLoop = new EventLoop();
    setupBuiltins(this.globalEnv);
  }

  async run(src: string, filename = '<anonymous>'): Promise<RuntimeValue> {
    const program = parse(src, filename);
    const result = await this.evaluateProgram(program);
    await this.eventLoop.triggerHook('on_start');
    await this.eventLoop.drain();
    if (this.hasActiveListeners) {
      // Keep process alive for active long polling / bot channels
      await new Promise(() => {});
    }
    return result;
  }

  async evaluateProgram(program: Program): Promise<RuntimeValue> {
    let lastEvaluated: RuntimeValue = NULL_VAL;
    for (const stmt of program.body) {
      lastEvaluated = await this.evaluateStatement(stmt, this.globalEnv);
    }
    return lastEvaluated;
  }

  async evaluateStatement(stmt: Statement, env: Environment): Promise<RuntimeValue> {
    switch (stmt.kind) {
      case 'VarDecl':
        return this.evaluateVarDecl(stmt, env);

      case 'FnDecl':
        return this.evaluateFnDecl(stmt, env);

      case 'Block':
        return this.evaluateBlock(stmt, env);

      case 'IfStmt':
        return this.evaluateIfStmt(stmt, env);

      case 'ForStmt':
        return this.evaluateForStmt(stmt, env);

      case 'WhileStmt':
        return this.evaluateWhileStmt(stmt, env);

      case 'LoopStmt':
        return this.evaluateLoopStmt(stmt, env);

      case 'TryStmt':
        return this.evaluateTryStmt(stmt, env);

      case 'ReturnStmt': {
        const val = stmt.value ? await this.evaluateExpression(stmt.value, env) : NULL_VAL;
        throw new ReturnControl(val);
      }

      case 'BreakStmt':
        throw new BreakControl();

      case 'ContinueStmt':
        throw new ContinueControl();

      case 'EventDecl': {
        const evtVal: EventValue = { type: 'event', name: stmt.name };
        return env.declareVar(stmt.name, evtVal, true, false);
      }

      case 'ChannelDecl': {
        const tokenVal = await this.evaluateExpression(stmt.token, env);
        const tokenStr = stringifyValue(tokenVal);
        const adapter = createAdapter(stmt.platform, tokenStr);
        const chVal: ChannelValue = {
          type: 'channel',
          name: stmt.name,
          platform: stmt.platform,
          token: tokenStr,
          adapter,
        };
        return env.declareVar(stmt.name, chVal, true, false);
      }

      case 'ListenStmt': {
        const prevRoutesCount = this.routes.length;
        await this.evaluateBlock(stmt.body, env);
        const newRoutes = this.routes.slice(prevRoutesCount);

        for (const chName of stmt.channels) {
          let chVal: ChannelValue | undefined;
          try {
            const v = env.getVar(chName);
            if (v && v.type === 'channel') chVal = v as ChannelValue;
          } catch {}

          if (chVal && chVal.adapter) {
            const adapter: IChannelAdapter = chVal.adapter;

            // Register routes on adapter
            for (const routeStmt of newRoutes) {
              adapter.onCommand(routeStmt.pattern, async (params, ctx) => {
                const handlerEnv = new Environment(env, true);
                handlerEnv.declareVar('ctx', jsToLinkValue(ctx), true, false);
                handlerEnv.declareVar('send', makeNativeFn('send', async (args) => {
                  const target = stringifyValue(args[0] ?? NULL_VAL);
                  const msg = stringifyValue(args[1] ?? NULL_VAL);
                  const options = args[2]?.type === 'dict'
                    ? runtimeValueToJS(args[2]) as Record<string, unknown>
                    : undefined;
                  await adapter.sendMessage(target, msg, options);
                  return NULL_VAL;
                }), true, false);

                for (const [k, v] of Object.entries(params)) {
                  handlerEnv.declareVar(k, makeString(v), false, false);
                }

                try {
                  await this.evaluateBlock(routeStmt.body, handlerEnv);
                } finally {
                  handlerEnv.cleanupFlowVars();
                }
              });
            }

            // Register message handler on adapter
            adapter.onMessage(async (botMsg, ctx) => {
              const handlerEnv = new Environment(env, true);
              handlerEnv.declareVar('ctx', jsToLinkValue(ctx), true, false);
              handlerEnv.declareVar('send', makeNativeFn('send', async (args) => {
                const target = stringifyValue(args[0] ?? NULL_VAL);
                const msg = stringifyValue(args[1] ?? NULL_VAL);
                const options = args[2]?.type === 'dict'
                  ? runtimeValueToJS(args[2]) as Record<string, unknown>
                  : undefined;
                await adapter.sendMessage(target, msg, options);
                return NULL_VAL;
              }), true, false);

              try {
                await this.eventLoop.emit('message', [jsToLinkValue(botMsg)], handlerEnv);
              } finally {
                handlerEnv.cleanupFlowVars();
              }
            });

            await adapter.connect();
            this.hasActiveListeners = true;
          }
        }
        return NULL_VAL;
      }

      case 'OnStmt': {
        this.eventLoop.on(stmt.event, async (args, ctxEnv) => {
          const handlerEnv = new Environment(ctxEnv ?? env, true);
          for (let i = 0; i < stmt.params.length; i++) {
            const param = stmt.params[i];
            const argVal = args[i] ?? NULL_VAL;
            handlerEnv.declareVar(param.name, argVal, false, false);
          }
          try {
            if (stmt.body.kind === 'Block') {
              await this.evaluateBlock(stmt.body, handlerEnv);
            } else {
              await this.evaluateExpression(stmt.body, handlerEnv);
            }
          } finally {
            // Clean up flow variables automatic lifetime
            handlerEnv.cleanupFlowVars();
          }
        });
        return NULL_VAL;
      }

      case 'RouteStmt': {
        this.routes.push(stmt);
        return NULL_VAL;
      }

      case 'HookStmt': {
        this.eventLoop.hook(stmt.name, async (args) => {
          const hookEnv = new Environment(env, true);
          for (let i = 0; i < stmt.params.length; i++) {
            hookEnv.declareVar(stmt.params[i].name, args[i] ?? NULL_VAL, false, false);
          }
          try {
            await this.evaluateBlock(stmt.body, hookEnv);
          } finally {
            hookEnv.cleanupFlowVars();
          }
        });
        return NULL_VAL;
      }

      case 'EmitStmt': {
        const evalArgs: RuntimeValue[] = [];
        for (const arg of stmt.args) {
          evalArgs.push(await this.evaluateExpression(arg.value, env));
        }
        await this.eventLoop.emit(stmt.event, evalArgs);
        return NULL_VAL;
      }

      case 'WaitStmt': {
        await this.eventLoop.wait(stmt.duration.ms);
        return NULL_VAL;
      }

      case 'ExprStmt':
        return this.evaluateExpression(stmt.expr, env);

      case 'ImportDecl':
        // Standard library / adapter import stub
        return NULL_VAL;

      default:
        return NULL_VAL;
    }
  }

  async evaluateBlock(block: Block, parentEnv: Environment): Promise<RuntimeValue> {
    const scopeEnv = new Environment(parentEnv, parentEnv.isFlowScope);
    let last: RuntimeValue = NULL_VAL;
    try {
      for (const stmt of block.body) {
        last = await this.evaluateStatement(stmt, scopeEnv);
      }
    } finally {
      // Cleanup request/handler scoped flow variables
      scopeEnv.cleanupFlowVars();
    }
    return last;
  }

  async evaluateVarDecl(stmt: VarDecl, env: Environment): Promise<RuntimeValue> {
    const val = stmt.init ? await this.evaluateExpression(stmt.init, env) : NULL_VAL;
    const isConst = stmt.varKind === 'const';
    const isFlow = stmt.varKind === 'flow';
    return env.declareVar(stmt.name, val, isConst, isFlow);
  }

  evaluateFnDecl(stmt: FnDecl, env: Environment): RuntimeValue {
    const fnVal: FunctionValue = {
      type: 'function',
      name: stmt.name,
      params: stmt.params,
      body: stmt.body,
      closure: env,
      isAsync: stmt.isAsync,
    };
    return env.declareVar(stmt.name, fnVal, false, false);
  }

  async evaluateIfStmt(stmt: IfStmt, env: Environment): Promise<RuntimeValue> {
    const condVal = await this.evaluateExpression(stmt.condition, env);
    if (isTruthy(condVal)) {
      return this.evaluateBlock(stmt.consequent, env);
    }

    for (const elif of stmt.alternates) {
      const eCond = await this.evaluateExpression(elif.condition, env);
      if (isTruthy(eCond)) {
        return this.evaluateBlock(elif.consequent, env);
      }
    }

    if (stmt.alternate) {
      return this.evaluateBlock(stmt.alternate, env);
    }

    return NULL_VAL;
  }

  async evaluateForStmt(stmt: ForStmt, env: Environment): Promise<RuntimeValue> {
    const iterableVal = await this.evaluateExpression(stmt.iterable, env);
    let elements: RuntimeValue[] = [];

    if (iterableVal.type === 'array') {
      elements = iterableVal.elements;
    } else if (iterableVal.type === 'string') {
      elements = iterableVal.value.split('').map((c) => makeString(c));
    } else if (iterableVal.type === 'dict') {
      elements = Array.from(iterableVal.entries.keys()).map((k) => makeString(k));
    } else {
      throw new Error(`Cannot iterate over type '${iterableVal.type}'`);
    }

    let last: RuntimeValue = NULL_VAL;
    for (const el of elements) {
      const loopEnv = new Environment(env);
      loopEnv.declareVar(stmt.variable, el, false, false);
      try {
        last = await this.evaluateBlock(stmt.body, loopEnv);
      } catch (control) {
        if (control instanceof BreakControl) break;
        if (control instanceof ContinueControl) continue;
        throw control;
      }
    }
    return last;
  }

  async evaluateWhileStmt(stmt: WhileStmt, env: Environment): Promise<RuntimeValue> {
    let last: RuntimeValue = NULL_VAL;
    while (isTruthy(await this.evaluateExpression(stmt.condition, env))) {
      try {
        last = await this.evaluateBlock(stmt.body, env);
      } catch (control) {
        if (control instanceof BreakControl) break;
        if (control instanceof ContinueControl) continue;
        throw control;
      }
    }
    return last;
  }

  async evaluateLoopStmt(stmt: LoopStmt, env: Environment): Promise<RuntimeValue> {
    let last: RuntimeValue = NULL_VAL;
    while (true) {
      try {
        last = await this.evaluateBlock(stmt.body, env);
      } catch (control) {
        if (control instanceof BreakControl) break;
        if (control instanceof ContinueControl) continue;
        throw control;
      }
    }
    return last;
  }

  async evaluateTryStmt(stmt: TryStmt, env: Environment): Promise<RuntimeValue> {
    let result: RuntimeValue = NULL_VAL;
    try {
      result = await this.evaluateBlock(stmt.body, env);
    } catch (err: any) {
      if (err instanceof ReturnControl || err instanceof BreakControl || err instanceof ContinueControl) {
        throw err;
      }
      if (stmt.catchClause) {
        const catchEnv = new Environment(env);
        const errMsg = err.message ?? String(err);
        catchEnv.declareVar(stmt.catchClause.param, makeString(errMsg), false, false);
        result = await this.evaluateBlock(stmt.catchClause.body, catchEnv);
      }
    } finally {
      if (stmt.finallyClause) {
        await this.evaluateBlock(stmt.finallyClause, env);
      }
    }
    return result;
  }

  // ─── Expression Evaluation ───────────────────────────────────────────────

  async evaluateExpression(expr: Expression, env: Environment): Promise<RuntimeValue> {
    switch (expr.kind) {
      case 'IntegerLiteral':
      case 'FloatLiteral':
        return makeNumber(expr.value);

      case 'DurationLiteral':
        return makeDuration(expr.amount, expr.unit, expr.ms);

      case 'StringLiteral':
        return makeString(expr.value);

      case 'TemplateLiteral': {
        let res = '';
        for (const part of expr.parts) {
          if (part.type === 'text') {
            res += part.text ?? '';
          } else if (part.expr) {
            const val = await this.evaluateExpression(part.expr, env);
            res += stringifyValue(val);
          }
        }
        return makeString(res);
      }

      case 'BoolLiteral':
        return makeBool(expr.value);

      case 'NullLiteral':
        return NULL_VAL;

      case 'ArrayLiteral': {
        const elems: RuntimeValue[] = [];
        for (const el of expr.elements) {
          elems.push(await this.evaluateExpression(el, env));
        }
        return makeArray(elems);
      }

      case 'DictLiteral': {
        const entries = new Map<string, RuntimeValue>();
        for (const entry of expr.entries) {
          let kStr = '';
          if (typeof entry.key === 'string') {
            kStr = entry.key;
          } else {
            const kVal = await this.evaluateExpression(entry.key, env);
            kStr = stringifyValue(kVal);
          }
          const vVal = await this.evaluateExpression(entry.value, env);
          entries.set(kStr, vVal);
        }
        return makeDict(entries);
      }

      case 'Identifier':
        return env.getVar(expr.name);

      case 'AssignExpr': {
        const rightVal = await this.evaluateExpression(expr.value, env);
        if (expr.target.kind === 'Identifier') {
          if (expr.op === '=') {
            return env.assignVar(expr.target.name, rightVal);
          } else {
            const curr = env.getVar(expr.target.name);
            const updated = await this.evaluateBinaryOp(expr.op.slice(0, 1) as any, curr, rightVal);
            return env.assignVar(expr.target.name, updated);
          }
        } else if (expr.target.kind === 'MemberExpr') {
          const obj = await this.evaluateExpression(expr.target.object, env);
          if (obj.type === 'dict') {
            obj.entries.set(expr.target.property, rightVal);
            return rightVal;
          }
          throw new Error(`Cannot assign property on type '${obj.type}'`);
        }
        throw new Error(`Invalid assignment target '${expr.target.kind}'`);
      }

      case 'BinaryExpr': {
        const left = await this.evaluateExpression(expr.left, env);
        // Short-circuit logical ops
        if (expr.op === '&&') {
          return isTruthy(left) ? await this.evaluateExpression(expr.right, env) : left;
        }
        if (expr.op === '||') {
          return isTruthy(left) ? left : await this.evaluateExpression(expr.right, env);
        }
        if (expr.op === '??') {
          return left.type !== 'null' ? left : await this.evaluateExpression(expr.right, env);
        }
        const right = await this.evaluateExpression(expr.right, env);
        return this.evaluateBinaryOp(expr.op, left, right);
      }

      case 'UnaryExpr': {
        const val = await this.evaluateExpression(expr.operand, env);
        if (expr.op === '!') return makeBool(!isTruthy(val));
        if (expr.op === '-') {
          if (val.type === 'number') return makeNumber(-val.value);
          throw new Error(`Cannot apply unary '-' to ${val.type}`);
        }
        return NULL_VAL;
      }

      case 'CallExpr': {
        const callee = await this.evaluateExpression(expr.callee, env);
        const args: RuntimeValue[] = [];
        for (const arg of expr.args) {
          args.push(await this.evaluateExpression(arg.value, env));
        }
        return this.callValue(callee, args);
      }

      case 'MemberExpr': {
        const obj = await this.evaluateExpression(expr.object, env);
        if (expr.optional && obj.type === 'null') return NULL_VAL;
        if (obj.type === 'dict') {
          return obj.entries.get(expr.property) ?? NULL_VAL;
        }
        throw new Error(`Property '${expr.property}' does not exist on type '${obj.type}'`);
      }

      case 'IndexExpr': {
        const obj = await this.evaluateExpression(expr.object, env);
        const idx = await this.evaluateExpression(expr.index, env);
        if (obj.type === 'array' && idx.type === 'number') {
          return obj.elements[idx.value] ?? NULL_VAL;
        }
        if (obj.type === 'dict') {
          const keyStr = stringifyValue(idx);
          return obj.entries.get(keyStr) ?? NULL_VAL;
        }
        if (obj.type === 'string' && idx.type === 'number') {
          return makeString(obj.value[idx.value] ?? '');
        }
        throw new Error(`Cannot index '${obj.type}' with '${idx.type}'`);
      }

      case 'LambdaExpr': {
        const lambdaVal: FunctionValue = {
          type: 'function',
          name: '<lambda>',
          params: expr.params,
          body: expr.body,
          closure: env,
          isAsync: expr.isAsync,
        };
        return lambdaVal;
      }

      case 'PipeExpr': {
        // msg.text |> trim |> lowercase
        const leftVal = await this.evaluateExpression(expr.left, env);
        const fnVal = await this.evaluateExpression(expr.fn, env);
        return this.callValue(fnVal, [leftVal]);
      }

      case 'RetryExpr': {
        // result = api.fetch(url) ~> retry(3, delay: 500ms)
        let delayMs = 0;
        for (const opt of expr.options) {
          if (opt.key === 'delay') {
            const dVal = await this.evaluateExpression(opt.value, env);
            if (dVal.type === 'duration') delayMs = dVal.ms;
            else if (dVal.type === 'number') delayMs = dVal.value;
          }
        }

        let attempts = 0;
        let lastErr: any;
        while (attempts <= expr.times) {
          try {
            return await this.evaluateExpression(expr.expr, env);
          } catch (err) {
            lastErr = err;
            attempts++;
            if (attempts <= expr.times && delayMs > 0) {
              await this.eventLoop.wait(delayMs);
            }
          }
        }
        throw lastErr;
      }

      case 'AwaitExpr': {
        return this.evaluateExpression(expr.expr, env);
      }

      case 'TernaryExpr': {
        const cond = await this.evaluateExpression(expr.condition, env);
        if (isTruthy(cond)) {
          return this.evaluateExpression(expr.consequent, env);
        }
        return this.evaluateExpression(expr.alternate, env);
      }

      default:
        throw new Error(`Unsupported expression kind '${(expr as any).kind}'`);
    }
  }

  async callValue(callee: RuntimeValue, args: RuntimeValue[]): Promise<RuntimeValue> {
    if (callee.type === 'native_function') {
      return callee.fn(args, this.globalEnv);
    }
    if (callee.type === 'function') {
      const fnEnv = new Environment(callee.closure);
      for (let i = 0; i < callee.params.length; i++) {
        const p = callee.params[i];
        let argVal = args[i];
        if (!argVal && p.defaultValue) {
          argVal = await this.evaluateExpression(p.defaultValue, fnEnv);
        }
        fnEnv.declareVar(p.name, argVal ?? NULL_VAL, false, false);
      }
      try {
        if (callee.body.kind === 'Block') {
          return await this.evaluateBlock(callee.body, fnEnv);
        } else {
          return await this.evaluateExpression(callee.body, fnEnv);
        }
      } catch (control) {
        if (control instanceof ReturnControl) {
          return control.value;
        }
        throw control;
      }
    }
    throw new Error(`Type '${callee.type}' is not callable`);
  }

  async evaluateBinaryOp(op: string, left: RuntimeValue, right: RuntimeValue): Promise<RuntimeValue> {
    if (op === '==') return makeBool(this.valuesEqual(left, right));
    if (op === '!=') return makeBool(!this.valuesEqual(left, right));

    if (left.type === 'number' && right.type === 'number') {
      switch (op) {
        case '+': return makeNumber(left.value + right.value);
        case '-': return makeNumber(left.value - right.value);
        case '*': return makeNumber(left.value * right.value);
        case '/': return makeNumber(left.value / right.value);
        case '%': return makeNumber(left.value % right.value);
        case '**': return makeNumber(left.value ** right.value);
        case '<': return makeBool(left.value < right.value);
        case '>': return makeBool(left.value > right.value);
        case '<=': return makeBool(left.value <= right.value);
        case '>=': return makeBool(left.value >= right.value);
      }
    }

    if (op === '+' && (left.type === 'string' || right.type === 'string')) {
      return makeString(stringifyValue(left) + stringifyValue(right));
    }

    throw new Error(`Operator '${op}' not supported for types '${left.type}' and '${right.type}'`);
  }

  valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'null') return true;
    if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
    if (a.type === 'number' && b.type === 'number') return a.value === b.value;
    if (a.type === 'string' && b.type === 'string') return a.value === b.value;
    return false;
  }
}
