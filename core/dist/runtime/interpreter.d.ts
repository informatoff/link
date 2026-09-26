/**
 * Link Language Tree-Walking Interpreter
 * Executes Link AST nodes with full async, event loop, and flow variable support.
 */
import type { Program, Statement, Expression, Block, VarDecl, FnDecl, IfStmt, ForStmt, WhileStmt, LoopStmt, TryStmt } from '../ast/index.js';
import { type RuntimeValue } from './value.js';
import { Environment } from './environment.js';
import { EventLoop } from './eventloop.js';
export declare class ReturnControl {
    readonly value: RuntimeValue;
    constructor(value: RuntimeValue);
}
export declare class BreakControl {
}
export declare class ContinueControl {
}
export declare class Interpreter {
    globalEnv: Environment;
    eventLoop: EventLoop;
    private routes;
    hasActiveListeners: boolean;
    constructor();
    run(src: string, filename?: string): Promise<RuntimeValue>;
    evaluateProgram(program: Program): Promise<RuntimeValue>;
    evaluateStatement(stmt: Statement, env: Environment): Promise<RuntimeValue>;
    evaluateBlock(block: Block, parentEnv: Environment): Promise<RuntimeValue>;
    evaluateVarDecl(stmt: VarDecl, env: Environment): Promise<RuntimeValue>;
    evaluateFnDecl(stmt: FnDecl, env: Environment): RuntimeValue;
    evaluateIfStmt(stmt: IfStmt, env: Environment): Promise<RuntimeValue>;
    evaluateForStmt(stmt: ForStmt, env: Environment): Promise<RuntimeValue>;
    evaluateWhileStmt(stmt: WhileStmt, env: Environment): Promise<RuntimeValue>;
    evaluateLoopStmt(stmt: LoopStmt, env: Environment): Promise<RuntimeValue>;
    evaluateTryStmt(stmt: TryStmt, env: Environment): Promise<RuntimeValue>;
    evaluateExpression(expr: Expression, env: Environment): Promise<RuntimeValue>;
    callValue(callee: RuntimeValue, args: RuntimeValue[]): Promise<RuntimeValue>;
    evaluateBinaryOp(op: string, left: RuntimeValue, right: RuntimeValue): Promise<RuntimeValue>;
    valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean;
}
//# sourceMappingURL=interpreter.d.ts.map