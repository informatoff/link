/**
 * Link Language Environment (Lexical Scope)
 * Supports let, const, and flow variables.
 */
import type { RuntimeValue } from './value.js';
export interface VariableBinding {
    value: RuntimeValue;
    isConst: boolean;
    isFlow: boolean;
}
export declare class Environment {
    private bindings;
    parent?: Environment;
    isFlowScope: boolean;
    constructor(parent?: Environment, isFlowScope?: boolean);
    declareVar(name: string, value: RuntimeValue, isConst: boolean, isFlow: boolean): RuntimeValue;
    assignVar(name: string, value: RuntimeValue): RuntimeValue;
    getVar(name: string): RuntimeValue;
    resolve(name: string): Environment | undefined;
    /**
     * Cleans up flow variables declared in this scope
     */
    cleanupFlowVars(): void;
}
//# sourceMappingURL=environment.d.ts.map