/**
 * Link Language AST Node Definitions
 * Every construct in the language maps to a typed AST node.
 */

import type { Position } from '../lexer/index.js';

// ─── Base ─────────────────────────────────────────────────────────────────────

export interface BaseNode {
  pos: Position;
}

// ─── Discriminant union helper ────────────────────────────────────────────────

export type Node =
  | Program
  | Statement
  | Expression
  | Param
  | DictEntry
  | RouteParam
  | RetryOption;

// ─── Program ──────────────────────────────────────────────────────────────────

export interface Program extends BaseNode {
  kind: 'Program';
  body: Statement[];
}

// ─── Statements ───────────────────────────────────────────────────────────────

export type Statement =
  | ImportDecl
  | ExportDecl
  | VarDecl
  | FnDecl
  | StructDecl
  | ClassDecl
  | EventDecl
  | ChannelDecl
  | ListenStmt
  | OnStmt
  | RouteStmt
  | HookStmt
  | EmitStmt
  | WaitStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | LoopStmt
  | TryStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | ThrowStmt
  | ExprStmt
  | Block;

// Import / Export
export interface ImportDecl extends BaseNode {
  kind: 'ImportDecl';
  path: string;         // "net", "telegram", etc.
  alias?: string;       // as alias
}

export interface ExportDecl extends BaseNode {
  kind: 'ExportDecl';
  declaration: FnDecl | VarDecl | StructDecl | ClassDecl;
}

// Variable declarations: let, const, flow
export type VarKind = 'let' | 'const' | 'flow';

export interface VarDecl extends BaseNode {
  kind: 'VarDecl';
  varKind: VarKind;
  name: string;
  init?: Expression;
}

// Functions
export interface FnDecl extends BaseNode {
  kind: 'FnDecl';
  name: string;
  params: Param[];
  body: Block;
  isAsync: boolean;
}

export interface Param extends BaseNode {
  kind: 'Param';
  name: string;
  defaultValue?: Expression;
  isOptional: boolean;   // for route params: {reason?}
}

// Struct
export interface StructField extends BaseNode {
  kind: 'StructField';
  name: string;
  typeAnnotation?: string;
  defaultValue?: Expression;
}

export interface StructDecl extends BaseNode {
  kind: 'StructDecl';
  name: string;
  fields: StructField[];
}

// Class
export interface ClassDecl extends BaseNode {
  kind: 'ClassDecl';
  name: string;
  superClass?: string;
  members: (FnDecl | VarDecl)[];
}

// ─── Link-specific statements ─────────────────────────────────────────────────

// event user_joined
export interface EventDecl extends BaseNode {
  kind: 'EventDecl';
  name: string;
}

// channel bot = link telegram("TOKEN")
export interface ChannelDecl extends BaseNode {
  kind: 'ChannelDecl';
  name: string;
  platform: string;      // telegram, discord, vk
  token: Expression;
}

// listen bot, bot2 { ... }
export interface ListenStmt extends BaseNode {
  kind: 'ListenStmt';
  channels: string[];    // identifiers
  body: Block;
}

// on message(msg) { ... }  OR  on message(msg) => expr
export interface OnStmt extends BaseNode {
  kind: 'OnStmt';
  event: string;
  params: Param[];
  body: Block | Expression;
}

// route "/start" { ... }
export interface RouteStmt extends BaseNode {
  kind: 'RouteStmt';
  pattern: string;
  routeParams: RouteParam[];   // parsed from pattern
  body: Block;
  requires: RequireClause[];
}

export interface RouteParam {
  name: string;
  isOptional: boolean;
}

export interface RequireClause extends BaseNode {
  kind: 'RequireClause';
  key: string;
  value: Expression;
}

// hook on_start { ... }
export interface HookStmt extends BaseNode {
  kind: 'HookStmt';
  name: string;
  params: Param[];
  body: Block;
}

// emit user_joined(data)
export interface EmitStmt extends BaseNode {
  kind: 'EmitStmt';
  event: string;
  args: Argument[];
}

// wait 500ms
export interface WaitStmt extends BaseNode {
  kind: 'WaitStmt';
  duration: DurationLiteral;
}

// ─── Control flow ─────────────────────────────────────────────────────────────

export interface IfStmt extends BaseNode {
  kind: 'IfStmt';
  condition: Expression;
  consequent: Block;
  alternates: ElifClause[];
  alternate?: Block;
}

export interface ElifClause extends BaseNode {
  kind: 'ElifClause';
  condition: Expression;
  consequent: Block;
}

export interface ForStmt extends BaseNode {
  kind: 'ForStmt';
  variable: string;
  iterable: Expression;
  body: Block;
}

export interface WhileStmt extends BaseNode {
  kind: 'WhileStmt';
  condition: Expression;
  body: Block;
}

export interface LoopStmt extends BaseNode {
  kind: 'LoopStmt';
  body: Block;
}

export interface TryStmt extends BaseNode {
  kind: 'TryStmt';
  body: Block;
  catchClause?: { param: string; body: Block };
  finallyClause?: Block;
}

export interface ReturnStmt extends BaseNode {
  kind: 'ReturnStmt';
  value?: Expression;
}

export interface BreakStmt extends BaseNode {
  kind: 'BreakStmt';
}

export interface ContinueStmt extends BaseNode {
  kind: 'ContinueStmt';
}

export interface ThrowStmt extends BaseNode {
  kind: 'ThrowStmt';
  value: Expression;
}

export interface ExprStmt extends BaseNode {
  kind: 'ExprStmt';
  expr: Expression;
}

export interface Block extends BaseNode {
  kind: 'Block';
  body: Statement[];
}

// ─── Expressions ──────────────────────────────────────────────────────────────

export type Expression =
  | IntegerLiteral
  | FloatLiteral
  | DurationLiteral
  | StringLiteral
  | TemplateLiteral
  | BoolLiteral
  | NullLiteral
  | ArrayLiteral
  | DictLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | AssignExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | LambdaExpr
  | PipeExpr
  | RetryExpr
  | AwaitExpr
  | TernaryExpr
  | NewExpr
  | OptionalChainExpr;

// ─── Literals ─────────────────────────────────────────────────────────────────

export interface IntegerLiteral extends BaseNode {
  kind: 'IntegerLiteral';
  value: number;
}

export interface FloatLiteral extends BaseNode {
  kind: 'FloatLiteral';
  value: number;
}

export interface DurationLiteral extends BaseNode {
  kind: 'DurationLiteral';
  amount: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w';
  /** Total value in milliseconds */
  ms: number;
}

export interface StringLiteral extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export interface TemplatePart {
  type: 'text' | 'expr';
  text?: string;
  expr?: Expression;
}

export interface TemplateLiteral extends BaseNode {
  kind: 'TemplateLiteral';
  parts: TemplatePart[];
  raw: string;
}

export interface BoolLiteral extends BaseNode {
  kind: 'BoolLiteral';
  value: boolean;
}

export interface NullLiteral extends BaseNode {
  kind: 'NullLiteral';
}

export interface ArrayLiteral extends BaseNode {
  kind: 'ArrayLiteral';
  elements: Expression[];
}

export interface DictEntry {
  key: string | Expression;
  value: Expression;
}

export interface DictLiteral extends BaseNode {
  kind: 'DictLiteral';
  entries: DictEntry[];
}

// ─── Complex expressions ──────────────────────────────────────────────────────

export interface Identifier extends BaseNode {
  kind: 'Identifier';
  name: string;
}

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%' | '**'
  | '==' | '!=' | '<' | '>' | '<=' | '>='
  | '&&' | '||'
  | '??';

export interface BinaryExpr extends BaseNode {
  kind: 'BinaryExpr';
  op: BinaryOp;
  left: Expression;
  right: Expression;
}

export type UnaryOp = '!' | '-';

export interface UnaryExpr extends BaseNode {
  kind: 'UnaryExpr';
  op: UnaryOp;
  operand: Expression;
}

export type AssignOp = '=' | '+=' | '-=' | '*=' | '/=';

export interface AssignExpr extends BaseNode {
  kind: 'AssignExpr';
  op: AssignOp;
  target: Expression;  // Identifier | MemberExpr | IndexExpr
  value: Expression;
}

export interface Argument {
  label?: string;       // named argument: delay: 500ms
  value: Expression;
}

export interface CallExpr extends BaseNode {
  kind: 'CallExpr';
  callee: Expression;
  args: Argument[];
}

export interface MemberExpr extends BaseNode {
  kind: 'MemberExpr';
  object: Expression;
  property: string;
  optional: boolean;   // ?. operator
}

export interface IndexExpr extends BaseNode {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export interface OptionalChainExpr extends BaseNode {
  kind: 'OptionalChainExpr';
  object: Expression;
  property: string;
}

export interface LambdaExpr extends BaseNode {
  kind: 'LambdaExpr';
  params: Param[];
  body: Expression | Block;
  isAsync: boolean;
}

// msg.text |> trim |> lowercase
export interface PipeExpr extends BaseNode {
  kind: 'PipeExpr';
  left: Expression;
  fn: Expression;   // identifier or call
}

// fetch(url) ~> retry(3, delay: 500ms)
export interface RetryOption {
  key: string;
  value: Expression;
}

export interface RetryExpr extends BaseNode {
  kind: 'RetryExpr';
  expr: Expression;
  times: number;
  options: RetryOption[];
}

export interface AwaitExpr extends BaseNode {
  kind: 'AwaitExpr';
  expr: Expression;
}

export interface TernaryExpr extends BaseNode {
  kind: 'TernaryExpr';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface NewExpr extends BaseNode {
  kind: 'NewExpr';
  constructor: string;
  args: Argument[];
}
