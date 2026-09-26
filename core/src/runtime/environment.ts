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

export class Environment {
  private bindings: Map<string, VariableBinding> = new Map();
  public parent?: Environment;
  public isFlowScope: boolean = false;

  constructor(parent?: Environment, isFlowScope = false) {
    this.parent = parent;
    this.isFlowScope = isFlowScope;
  }

  declareVar(name: string, value: RuntimeValue, isConst: boolean, isFlow: boolean): RuntimeValue {
    if (this.bindings.has(name)) {
      throw new Error(`Variable '${name}' is already declared in this scope.`);
    }
    this.bindings.set(name, { value, isConst, isFlow });
    return value;
  }

  assignVar(name: string, value: RuntimeValue): RuntimeValue {
    const env = this.resolve(name);
    if (!env) {
      throw new Error(`Cannot assign to undeclared variable '${name}'.`);
    }
    const binding = env.bindings.get(name)!;
    if (binding.isConst) {
      throw new Error(`Cannot reassign constant variable '${name}'.`);
    }
    binding.value = value;
    return value;
  }

  getVar(name: string): RuntimeValue {
    const env = this.resolve(name);
    if (!env) {
      throw new Error(`Undefined variable '${name}'.`);
    }
    return env.bindings.get(name)!.value;
  }

  resolve(name: string): Environment | undefined {
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
  cleanupFlowVars(): void {
    for (const [name, binding] of Array.from(this.bindings.entries())) {
      if (binding.isFlow) {
        this.bindings.delete(name);
      }
    }
  }
}
