"use strict";
/**
 * Link Language Environment (Lexical Scope)
 * Supports let, const, and flow variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
class Environment {
    bindings = new Map();
    parent;
    isFlowScope = false;
    constructor(parent, isFlowScope = false) {
        this.parent = parent;
        this.isFlowScope = isFlowScope;
    }
    declareVar(name, value, isConst, isFlow) {
        if (this.bindings.has(name)) {
            throw new Error(`Variable '${name}' is already declared in this scope.`);
        }
        this.bindings.set(name, { value, isConst, isFlow });
        return value;
    }
    assignVar(name, value) {
        const env = this.resolve(name);
        if (!env) {
            throw new Error(`Cannot assign to undeclared variable '${name}'.`);
        }
        const binding = env.bindings.get(name);
        if (binding.isConst) {
            throw new Error(`Cannot reassign constant variable '${name}'.`);
        }
        binding.value = value;
        return value;
    }
    getVar(name) {
        const env = this.resolve(name);
        if (!env) {
            throw new Error(`Undefined variable '${name}'.`);
        }
        return env.bindings.get(name).value;
    }
    resolve(name) {
        if (this.bindings.has(name)) {
            return this;
        }
        if (this.parent) {
            return this.parent.resolve(name);
        }
        return undefined;
    }
    /**
     * Cleans up flow variables declared in this scope
     */
    cleanupFlowVars() {
        for (const [name, binding] of Array.from(this.bindings.entries())) {
            if (binding.isFlow) {
                this.bindings.delete(name);
            }
        }
    }
}
exports.Environment = Environment;
//# sourceMappingURL=environment.js.map