/**
 * Link Language Parser
 *
 * Architecture:
 *  - Recursive descent for statements
 *  - Pratt parser (top-down operator precedence) for expressions
 *
 * Operator precedences (higher = tighter binding):
 *  1  assignment    = += -= *= /=
 *  2  ternary       ?:
 *  3  logical or    ||  ??
 *  4  logical and   &&
 *  5  equality      == !=
 *  6  comparison    < > <= >=
 *  7  additive      + -
 *  8  multiplicative * / %
 *  9  power         **
 * 10  unary         ! -
 * 11  call/member   () [] . ?.
 *
 * Custom operators:
 *  |>  parsed in expression as left-assoc, between assignment and ternary
 *  ~>  parsed as postfix-ish suffix on any expression
 *  await  prefix keyword expression
 */

import {
  TokenType,
  type Token,
  type DurationToken,
} from '../lexer/index.js';

import type {
  Program,
  Statement,
  Expression,
  Block,
  Param,
  Argument,
  DictEntry,
  RouteParam,
  RequireClause,
  RetryOption,
  TemplatePart,
  BinaryOp,
  AssignOp,
  UnaryOp,
  VarKind,
  // Statements
  ImportDecl,
  ExportDecl,
  VarDecl,
  FnDecl,
  StructDecl,
  StructField,
  ClassDecl,
  EventDecl,
  ChannelDecl,
  ListenStmt,
  OnStmt,
  RouteStmt,
  HookStmt,
  EmitStmt,
  WaitStmt,
  IfStmt,
  ElifClause,
  ForStmt,
  WhileStmt,
  LoopStmt,
  TryStmt,
  ReturnStmt,
  BreakStmt,
  ContinueStmt,
  ThrowStmt,
  ExprStmt,
  // Expressions
  IntegerLiteral,
  FloatLiteral,
  DurationLiteral,
  StringLiteral,
  TemplateLiteral,
  BoolLiteral,
  NullLiteral,
  ArrayLiteral,
  DictLiteral,
  Identifier,
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
  NewExpr,
} from '../ast/index.js';

import type { Position } from '../lexer/index.js';

// ─── Parse Error ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly pos: Position,
    public readonly filename: string = '<anonymous>',
    public readonly src?: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// ─── Pratt precedences ────────────────────────────────────────────────────────

const enum Prec {
  NONE        = 0,
  ASSIGN      = 1,
  PIPE        = 2,
  TERNARY     = 3,
  OR          = 4,
  AND         = 5,
  EQUALITY    = 6,
  COMPARISON  = 7,
  ADDITIVE    = 8,
  MULT        = 9,
  POWER       = 10,
  UNARY       = 11,
  CALL        = 12,
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private filename: string;
  private src: string;

  constructor(tokens: Token[], src: string = '', filename: string = '<anonymous>') {
    this.tokens = tokens;
    this.src = src;
    this.filename = filename;
  }

  // ─── Token navigation ──────────────────────────────────────────────────────

  private peek(offset = 0): Token {
    const idx = this.pos + offset;
    return this.tokens[idx] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (tok.type !== TokenType.EOF) this.pos++;
    return tok;
  }

  private check(type: TokenType): boolean {
    return this.currentType() === type;
  }

  private currentType(): TokenType {
    return this.peek().type;
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) { this.advance(); return true; }
    }
    return false;
  }

  private expect(type: TokenType, msg?: string): Token {
    if (this.check(type)) return this.advance();
    const tok = this.peek();
    throw new ParseError(
      msg ?? `Expected ${type}, got ${tok.type} ('${tok.value}')`,
      tok.pos,
      this.filename,
      this.src,
    );
  }

  private skipNewlines(): void {
    while (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }

  private currentPos(): Position {
    return this.peek().pos;
  }

  private error(msg: string, pos?: Position): ParseError {
    return new ParseError(msg, pos ?? this.currentPos(), this.filename, this.src);
  }

  /**
   * Lookahead: { IDENTIFIER : ... } or { STRING : ... } → dict literal
   * Otherwise → block
   */
  private looksLikeDict(): boolean {
    // { } empty — treat as block (ambiguous, prefer block)
    if (this.peek(1).type === TokenType.RBRACE) return false;
    // { IDENTIFIER : ... } or { STRING : ... }
    const second = this.peek(1).type;
    const third = this.peek(2).type;
    if (
      (second === TokenType.IDENTIFIER || second === TokenType.STRING) &&
      third === TokenType.COLON
    ) return true;
    return false;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  parse(): Program {
    const pos = this.currentPos();
    const body: Statement[] = [];

    this.skipNewlines();
    while (!this.check(TokenType.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }

    return { kind: 'Program', body, pos };
  }

  // ─── Statements ────────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    this.skipNewlines();
    const tok = this.peek();

    switch (tok.type) {
      case TokenType.IMPORT:   return this.parseImport();
      case TokenType.EXPORT:   return this.parseExport();
      case TokenType.LET:
      case TokenType.CONST:
      case TokenType.FLOW:     return this.parseVarDecl();
      case TokenType.ASYNC:
      case TokenType.FN:       return this.parseFnDecl();
      case TokenType.STRUCT:   return this.parseStructDecl();
      case TokenType.CLASS:    return this.parseClassDecl();
      case TokenType.EVENT:    return this.parseEventDecl();
      case TokenType.CHANNEL:  return this.parseChannelDecl();
      case TokenType.LISTEN:   return this.parseListenStmt();
      case TokenType.ON:       return this.parseOnStmt();
      case TokenType.ROUTE:    return this.parseRouteStmt();
      case TokenType.HOOK:     return this.parseHookStmt();
      case TokenType.EMIT:     return this.parseEmitStmt();
      case TokenType.WAIT:     return this.parseWaitStmt();
      case TokenType.IF:       return this.parseIfStmt();
      case TokenType.FOR:      return this.parseForStmt();
      case TokenType.WHILE:    return this.parseWhileStmt();
      case TokenType.LOOP:     return this.parseLoopStmt();
      case TokenType.TRY:      return this.parseTryStmt();
      case TokenType.RETURN:   return this.parseReturnStmt();
      case TokenType.BREAK:    return this.parseBreakStmt();
      case TokenType.CONTINUE: return this.parseContinueStmt();
      case TokenType.THROW:    return this.parseThrowStmt();
      case TokenType.LBRACE:   return this.looksLikeDict() ? this.parseExprStmt() : this.parseBlock();
      default:                 return this.parseExprStmt();
    }
  }

  // ─── import "module" [as alias] ────────────────────────────────────────────

  private parseImport(): ImportDecl {
    const pos = this.currentPos();
    this.expect(TokenType.IMPORT);
    const pathTok = this.expect(TokenType.STRING, 'Expected module path string after import');
    let alias: string | undefined;
    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'as') {
      this.advance(); // consume 'as'
      alias = this.expect(TokenType.IDENTIFIER).value;
    }
    this.consumeStatementEnd();
    return { kind: 'ImportDecl', path: pathTok.value, alias, pos };
  }

  // ─── export decl ───────────────────────────────────────────────────────────

  private parseExport(): ExportDecl {
    const pos = this.currentPos();
    this.expect(TokenType.EXPORT);
    const inner = this.parseStatement();
    if (
      inner.kind !== 'FnDecl' &&
      inner.kind !== 'VarDecl' &&
      inner.kind !== 'StructDecl' &&
      inner.kind !== 'ClassDecl'
    ) {
      throw this.error('export must be followed by fn, let, const, struct, or class');
    }
    return { kind: 'ExportDecl', declaration: inner as FnDecl | VarDecl | StructDecl | ClassDecl, pos };
  }

  // ─── Variable declarations: let / const / flow ─────────────────────────────

  private parseVarDecl(): VarDecl {
    const pos = this.currentPos();
    const kwTok = this.advance(); // let | const | flow
    const varKind = kwTok.value as VarKind;
    const name = this.expect(TokenType.IDENTIFIER).value;
    let init: Expression | undefined;
    if (this.match(TokenType.ASSIGN)) {
      init = this.parseExpression();
    }
    this.consumeStatementEnd();
    return { kind: 'VarDecl', varKind, name, init, pos };
  }

  // ─── Function declarations ─────────────────────────────────────────────────

  private parseFnDecl(allowAnonymous = false): FnDecl {
    const pos = this.currentPos();
    const isAsync = this.match(TokenType.ASYNC);
    this.expect(TokenType.FN);
    let name: string;
    if (allowAnonymous && !this.check(TokenType.IDENTIFIER)) {
      name = '<anonymous>';
    } else {
      name = this.expect(TokenType.IDENTIFIER).value;
    }
    this.expect(TokenType.LPAREN);
    const params = this.parseParamList();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { kind: 'FnDecl', name, params, body, isAsync, pos };
  }

  // ─── Struct ────────────────────────────────────────────────────────────────

  private parseStructDecl(): StructDecl {
    const pos = this.currentPos();
    this.expect(TokenType.STRUCT);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const fields: StructField[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const fpos = this.currentPos();
      const fname = this.expect(TokenType.IDENTIFIER).value;
      let typeAnnotation: string | undefined;
      let defaultValue: Expression | undefined;
      if (this.match(TokenType.COLON)) {
        if (this.check(TokenType.IDENTIFIER)) {
          typeAnnotation = this.advance().value;
        }
      }
      if (this.match(TokenType.ASSIGN)) {
        defaultValue = this.parseExpression();
      }
      fields.push({ kind: 'StructField', name: fname, typeAnnotation, defaultValue, pos: fpos });
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE);
    return { kind: 'StructDecl', name, fields, pos };
  }

  // ─── Class ─────────────────────────────────────────────────────────────────

  private parseClassDecl(): ClassDecl {
    const pos = this.currentPos();
    this.expect(TokenType.CLASS);
    const name = this.expect(TokenType.IDENTIFIER).value;
    let superClass: string | undefined;
    if (this.match(TokenType.EXTENDS)) {
      superClass = this.expect(TokenType.IDENTIFIER).value;
    }
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const members: (FnDecl | VarDecl)[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const stmt = this.parseStatement();
      if (stmt.kind === 'FnDecl' || stmt.kind === 'VarDecl') {
        members.push(stmt);
      } else {
        throw this.error(`Only fn and variable declarations allowed in class body, got ${stmt.kind}`);
      }
      this.skipNewlines();
    }
    this.expect(TokenType.RBRACE);
    return { kind: 'ClassDecl', name, superClass, members, pos };
  }

  // ─── event user_joined ─────────────────────────────────────────────────────

  private parseEventDecl(): EventDecl {
    const pos = this.currentPos();
    this.expect(TokenType.EVENT);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.consumeStatementEnd();
    return { kind: 'EventDecl', name, pos };
  }

  // ─── channel bot = link telegram("TOKEN") ──────────────────────────────────

  private parseChannelDecl(): ChannelDecl {
    const pos = this.currentPos();
    this.expect(TokenType.CHANNEL);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.ASSIGN);
    this.expect(TokenType.LINK);
    const platform = this.expect(TokenType.IDENTIFIER).value; // telegram | discord | vk
    this.expect(TokenType.LPAREN);
    const token = this.parseExpression();
    this.expect(TokenType.RPAREN);
    this.consumeStatementEnd();
    return { kind: 'ChannelDecl', name, platform, token, pos };
  }

  // ─── listen bot, bot2 { ... } ──────────────────────────────────────────────

  private parseListenStmt(): ListenStmt {
    const pos = this.currentPos();
    this.expect(TokenType.LISTEN);
    const channels: string[] = [];
    channels.push(this.expect(TokenType.IDENTIFIER).value);
    while (this.match(TokenType.COMMA)) {
      channels.push(this.expect(TokenType.IDENTIFIER).value);
    }
    const body = this.parseBlock();
    return { kind: 'ListenStmt', channels, body, pos };
  }

  // ─── on message(msg) { ... } | on message(msg) => expr ─────────────────────

  private parseOnStmt(): OnStmt {
    const pos = this.currentPos();
    this.expect(TokenType.ON);
    const event = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);
    const params = this.parseParamList();
    this.expect(TokenType.RPAREN);

    let body: Block | Expression;
    if (this.match(TokenType.ARROW)) {
      body = this.parseExpression();
      this.consumeStatementEnd();
    } else {
      body = this.parseBlock();
    }
    return { kind: 'OnStmt', event, params, body, pos };
  }

  // ─── route "/ban {user} {reason?}" { ... } ─────────────────────────────────

  private parseRouteStmt(): RouteStmt {
    const pos = this.currentPos();
    this.expect(TokenType.ROUTE);

    // Pattern is a string or template literal token — we keep it raw for matching
    const patTok = this.peek();
    let pattern: string;
    if (patTok.type === TokenType.STRING || patTok.type === TokenType.TEMPLATE) {
      pattern = patTok.value;
      this.advance();
    } else {
      throw this.error('Expected route pattern string');
    }

    // Parse route params from pattern: {user}, {reason?}
    const routeParams = this.extractRouteParams(pattern);

    // Parse body — may include require clauses
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const requires: RequireClause[] = [];
    const bodyStmts: Statement[] = [];

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.REQUIRE)) {
        requires.push(this.parseRequireClause());
      } else {
        bodyStmts.push(this.parseStatement());
      }
      this.skipNewlines();
    }
    this.expect(TokenType.RBRACE);

    const body: Block = { kind: 'Block', body: bodyStmts, pos };
    return { kind: 'RouteStmt', pattern, routeParams, body, requires, pos };
  }

  private extractRouteParams(pattern: string): RouteParam[] {
    const params: RouteParam[] = [];
    const re = /\{(\w+)(\?)?\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pattern)) !== null) {
      params.push({ name: m[1], isOptional: m[2] === '?' });
    }
    return params;
  }

  // ─── require permission: "admin" ───────────────────────────────────────────

  private parseRequireClause(): RequireClause {
    const pos = this.currentPos();
    this.expect(TokenType.REQUIRE);
    const key = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.COLON);
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { kind: 'RequireClause', key, value, pos };
  }

  // ─── hook on_start { ... } ─────────────────────────────────────────────────

  private parseHookStmt(): HookStmt {
    const pos = this.currentPos();
    this.expect(TokenType.HOOK);
    const name = this.expect(TokenType.IDENTIFIER).value;
    let params: Param[] = [];
    if (this.match(TokenType.LPAREN)) {
      params = this.parseParamList();
      this.expect(TokenType.RPAREN);
    }
    const body = this.parseBlock();
    return { kind: 'HookStmt', name, params, body, pos };
  }

  // ─── emit user_joined(data) ────────────────────────────────────────────────

  private parseEmitStmt(): EmitStmt {
    const pos = this.currentPos();
    this.expect(TokenType.EMIT);
    const event = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);
    const args = this.parseArgList();
    this.expect(TokenType.RPAREN);
    this.consumeStatementEnd();
    return { kind: 'EmitStmt', event, args, pos };
  }

  // ─── wait 500ms ────────────────────────────────────────────────────────────

  private parseWaitStmt(): WaitStmt {
    const pos = this.currentPos();
    this.expect(TokenType.WAIT);
    const durTok = this.peek();
    if (durTok.type !== TokenType.DURATION) {
      throw this.error('Expected duration literal after wait (e.g. 500ms, 5s)');
    }
    this.advance();
    const dur = durTok as DurationToken;
    const duration: DurationLiteral = {
      kind: 'DurationLiteral',
      amount: dur.amount,
      unit: dur.unit,
      ms: durationToMs(dur.amount, dur.unit),
      pos: dur.pos,
    };
    this.consumeStatementEnd();
    return { kind: 'WaitStmt', duration, pos };
  }

  // ─── if / elif / else ──────────────────────────────────────────────────────

  private parseIfStmt(): IfStmt {
    const pos = this.currentPos();
    this.expect(TokenType.IF);
    const condition = this.parseExpression();
    const consequent = this.parseBlock();

    const alternates: ElifClause[] = [];
    let alternate: Block | undefined;

    while (this.check(TokenType.ELIF)) {
      const epos = this.currentPos();
      this.advance();
      const econ = this.parseExpression();
      const ebody = this.parseBlock();
      alternates.push({ kind: 'ElifClause', condition: econ, consequent: ebody, pos: epos });
    }

    if (this.match(TokenType.ELSE)) {
      alternate = this.parseBlock();
    }

    return { kind: 'IfStmt', condition, consequent, alternates, alternate, pos };
  }

  // ─── for x in list { } ────────────────────────────────────────────────────

  private parseForStmt(): ForStmt {
    const pos = this.currentPos();
    this.expect(TokenType.FOR);
    const variable = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.IN);
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return { kind: 'ForStmt', variable, iterable, body, pos };
  }

  // ─── while cond { } ────────────────────────────────────────────────────────

  private parseWhileStmt(): WhileStmt {
    const pos = this.currentPos();
    this.expect(TokenType.WHILE);
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return { kind: 'WhileStmt', condition, body, pos };
  }

  // ─── loop { } ──────────────────────────────────────────────────────────────

  private parseLoopStmt(): LoopStmt {
    const pos = this.currentPos();
    this.expect(TokenType.LOOP);
    const body = this.parseBlock();
    return { kind: 'LoopStmt', body, pos };
  }

  // ─── try / catch / finally ─────────────────────────────────────────────────

  private parseTryStmt(): TryStmt {
    const pos = this.currentPos();
    this.expect(TokenType.TRY);
    const body = this.parseBlock();

    let catchClause: { param: string; body: Block } | undefined;
    let finallyClause: Block | undefined;

    if (this.match(TokenType.CATCH)) {
      this.expect(TokenType.LPAREN);
      const param = this.expect(TokenType.IDENTIFIER).value;
      this.expect(TokenType.RPAREN);
      const catchBody = this.parseBlock();
      catchClause = { param, body: catchBody };
    }

    if (this.match(TokenType.FINALLY)) {
      finallyClause = this.parseBlock();
    }

    return { kind: 'TryStmt', body, catchClause, finallyClause, pos };
  }

  // ─── return / break / continue / throw ─────────────────────────────────────

  private parseReturnStmt(): ReturnStmt {
    const pos = this.currentPos();
    this.expect(TokenType.RETURN);
    let value: Expression | undefined;
    if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      value = this.parseExpression();
    }
    this.consumeStatementEnd();
    return { kind: 'ReturnStmt', value, pos };
  }

  private parseBreakStmt(): BreakStmt {
    const pos = this.currentPos();
    this.expect(TokenType.BREAK);
    this.consumeStatementEnd();
    return { kind: 'BreakStmt', pos };
  }

  private parseContinueStmt(): ContinueStmt {
    const pos = this.currentPos();
    this.expect(TokenType.CONTINUE);
    this.consumeStatementEnd();
    return { kind: 'ContinueStmt', pos };
  }

  private parseThrowStmt(): ThrowStmt {
    const pos = this.currentPos();
    this.expect(TokenType.THROW);
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { kind: 'ThrowStmt', value, pos };
  }

  private parseExprStmt(): ExprStmt {
    const pos = this.currentPos();
    const expr = this.parseExpression();
    this.consumeStatementEnd();
    return { kind: 'ExprStmt', expr, pos };
  }

  // ─── Block { ... } ────────────────────────────────────────────────────────

  private parseBlock(): Block {
    const pos = this.currentPos();
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(TokenType.RBRACE);
    return { kind: 'Block', body, pos };
  }

  // ─── Parameter list ────────────────────────────────────────────────────────

  private parseParamList(): Param[] {
    const params: Param[] = [];
    if (this.check(TokenType.RPAREN)) return params;

    params.push(this.parseParam());
    while (this.match(TokenType.COMMA)) {
      if (this.check(TokenType.RPAREN)) break; // trailing comma
      params.push(this.parseParam());
    }
    return params;
  }

  private parseParam(): Param {
    const pos = this.currentPos();
    const name = this.expect(TokenType.IDENTIFIER).value;
    let defaultValue: Expression | undefined;
    let isOptional = false;

    if (this.match(TokenType.QUESTION)) {
      isOptional = true;
    }
    if (this.match(TokenType.ASSIGN)) {
      defaultValue = this.parseExpression();
      isOptional = true;
    }
    return { kind: 'Param', name, defaultValue, isOptional, pos };
  }

  // ─── Argument list ─────────────────────────────────────────────────────────

  private parseArgList(): Argument[] {
    const args: Argument[] = [];
    if (this.check(TokenType.RPAREN)) return args;

    args.push(this.parseArg());
    while (this.match(TokenType.COMMA)) {
      if (this.check(TokenType.RPAREN)) break;
      args.push(this.parseArg());
    }
    return args;
  }

  private parseArg(): Argument {
    // Named arg: label: value  (only if next two tokens are IDENTIFIER COLON)
    if (
      this.check(TokenType.IDENTIFIER) &&
      this.peek(1).type === TokenType.COLON
    ) {
      const label = this.advance().value;
      this.advance(); // colon
      const value = this.parseExpression();
      return { label, value };
    }
    return { value: this.parseExpression() };
  }

  // ─── Expression parsing (Pratt) ───────────────────────────────────────────

  private parseExpression(): Expression {
    return this.parsePrec(Prec.NONE);
  }

  private parsePrec(minPrec: number): Expression {
    let left = this.parseUnary();

    while (true) {
      // Check for pipe operator |>
      if (this.check(TokenType.PIPE) && Prec.PIPE > minPrec) {
        const pos = this.currentPos();
        this.advance();
        const fn = this.parseUnary();
        left = { kind: 'PipeExpr', left, fn, pos } satisfies PipeExpr;
        continue;
      }

      // Check for retry operator ~>
      if (this.check(TokenType.RETRY_OP) && Prec.ASSIGN < minPrec === false) {
        const pos = this.currentPos();
        this.advance(); // ~>
        this.expect(TokenType.RETRY, 'Expected retry(...) after ~>');
        this.expect(TokenType.LPAREN, 'Expected ( after retry');
        const timesTok = this.expect(TokenType.INTEGER, 'Expected retry count');
        const times = parseInt(timesTok.value, 10);
        const options: RetryOption[] = [];
        while (this.match(TokenType.COMMA)) {
          if (this.check(TokenType.RPAREN)) break;
          const key = this.expect(TokenType.IDENTIFIER).value;
          this.expect(TokenType.COLON);
          const val = this.parseExpression();
          options.push({ key, value: val });
        }
        this.expect(TokenType.RPAREN);
        left = { kind: 'RetryExpr', expr: left, times, options, pos } satisfies RetryExpr;
        continue;
      }

      // Ternary ?:
      if (this.check(TokenType.QUESTION) && Prec.TERNARY > minPrec) {
        const pos = this.currentPos();
        this.advance();
        const consequent = this.parsePrec(Prec.NONE);
        this.expect(TokenType.COLON, 'Expected : in ternary expression');
        const alternate = this.parsePrec(Prec.NONE);
        left = { kind: 'TernaryExpr', condition: left, consequent, alternate, pos };
        continue;
      }

      const op = this.getBinaryOp();
      if (op === null) break;

      const [opPrec, rightAssoc] = this.getPrec(op);
      if (opPrec <= minPrec) break;

      const pos = left.pos;
      this.advance(); // consume operator

      // Assignment operators are right-associative
      if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=') {
        const value = this.parsePrec(Prec.NONE);
        left = {
          kind: 'AssignExpr',
          op: op as AssignOp,
          target: left,
          value,
          pos,
        } satisfies AssignExpr;
      } else {
        const nextPrec = rightAssoc ? opPrec - 1 : opPrec;
        const right = this.parsePrec(nextPrec);
        left = {
          kind: 'BinaryExpr',
          op: op as BinaryOp,
          left,
          right,
          pos,
        } satisfies BinaryExpr;
      }
    }

    return left;
  }

  private getBinaryOp(): string | null {
    switch (this.currentType()) {
      case TokenType.PLUS:        return '+';
      case TokenType.MINUS:       return '-';
      case TokenType.STAR:        return '*';
      case TokenType.SLASH:       return '/';
      case TokenType.PERCENT:     return '%';
      case TokenType.POWER:       return '**';
      case TokenType.EQ:          return '==';
      case TokenType.NEQ:         return '!=';
      case TokenType.LT:          return '<';
      case TokenType.GT:          return '>';
      case TokenType.LTE:         return '<=';
      case TokenType.GTE:         return '>=';
      case TokenType.AND:         return '&&';
      case TokenType.OR:          return '||';
      case TokenType.NULLISH_COAL:return '??';
      case TokenType.ASSIGN:      return '=';
      case TokenType.PLUS_ASSIGN: return '+=';
      case TokenType.MINUS_ASSIGN:return '-=';
      case TokenType.STAR_ASSIGN: return '*=';
      case TokenType.SLASH_ASSIGN:return '/=';
      default: return null;
    }
  }

  private getPrec(op: string): [number, boolean] {
    switch (op) {
      case '=': case '+=': case '-=': case '*=': case '/=':
        return [Prec.ASSIGN, true];
      case '||': case '??':
        return [Prec.OR, false];
      case '&&':
        return [Prec.AND, false];
      case '==': case '!=':
        return [Prec.EQUALITY, false];
      case '<': case '>': case '<=': case '>=':
        return [Prec.COMPARISON, false];
      case '+': case '-':
        return [Prec.ADDITIVE, false];
      case '*': case '/': case '%':
        return [Prec.MULT, false];
      case '**':
        return [Prec.POWER, true]; // right-associative
      default:
        return [Prec.NONE, false];
    }
  }

  // ─── Unary ────────────────────────────────────────────────────────────────

  private parseUnary(): Expression {
    const pos = this.currentPos();

    if (this.check(TokenType.NOT)) {
      this.advance();
      return { kind: 'UnaryExpr', op: '!' as UnaryOp, operand: this.parseUnary(), pos };
    }

    if (this.check(TokenType.MINUS)) {
      this.advance();
      return { kind: 'UnaryExpr', op: '-' as UnaryOp, operand: this.parseUnary(), pos };
    }

    if (this.check(TokenType.AWAIT)) {
      this.advance();
      const expr = this.parseUnary();
      return { kind: 'AwaitExpr', expr, pos } satisfies AwaitExpr;
    }

    return this.parseCall();
  }

  // ─── Call / member / index expressions ────────────────────────────────────

  private parseCall(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.LPAREN)) {
        const pos = this.currentPos();
        this.advance();
        const args = this.parseArgList();
        this.expect(TokenType.RPAREN);
        expr = { kind: 'CallExpr', callee: expr, args, pos } satisfies CallExpr;
      } else if (this.check(TokenType.DOT)) {
        const pos = this.currentPos();
        this.advance();
        const prop = this.expect(TokenType.IDENTIFIER).value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, optional: false, pos } satisfies MemberExpr;
      } else if (this.check(TokenType.OPTIONAL_CHAIN)) {
        const pos = this.currentPos();
        this.advance();
        const prop = this.expect(TokenType.IDENTIFIER).value;
        expr = { kind: 'MemberExpr', object: expr, property: prop, optional: true, pos } satisfies MemberExpr;
      } else if (this.check(TokenType.LBRACKET)) {
        const pos = this.currentPos();
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET);
        expr = { kind: 'IndexExpr', object: expr, index, pos } satisfies IndexExpr;
      } else {
        break;
      }
    }

    return expr;
  }

  // ─── Primary expressions ─────────────────────────────────────────────────

  private parsePrimary(): Expression {
    const tok = this.peek();
    const pos = tok.pos;

    switch (tok.type) {
      case TokenType.INTEGER:
        this.advance();
        return { kind: 'IntegerLiteral', value: parseInt(tok.value, 10), pos } satisfies IntegerLiteral;

      case TokenType.FLOAT:
        this.advance();
        return { kind: 'FloatLiteral', value: parseFloat(tok.value), pos } satisfies FloatLiteral;

      case TokenType.DURATION: {
        this.advance();
        const dt = tok as DurationToken;
        return {
          kind: 'DurationLiteral',
          amount: dt.amount,
          unit: dt.unit,
          ms: durationToMs(dt.amount, dt.unit),
          pos,
        } satisfies DurationLiteral;
      }

      case TokenType.STRING:
        this.advance();
        return { kind: 'StringLiteral', value: tok.value, pos } satisfies StringLiteral;

      case TokenType.TEMPLATE:
        this.advance();
        return this.parseTemplate(tok.value, pos);

      case TokenType.BOOL:
        this.advance();
        return { kind: 'BoolLiteral', value: tok.value === 'true', pos } satisfies BoolLiteral;

      case TokenType.NULL:
        this.advance();
        return { kind: 'NullLiteral', pos } satisfies NullLiteral;

      case TokenType.LBRACKET:
        return this.parseArrayLiteral();

      case TokenType.LBRACE:
        return this.parseDictLiteral();

      case TokenType.LPAREN:
        return this.parseParenOrLambda();

      case TokenType.NEW:
        return this.parseNewExpr();

      case TokenType.ASYNC:
      case TokenType.FN:
        return this.parseFnLiteralAsLambda();

      case TokenType.IDENTIFIER: {
        // Peek ahead: is this a single-param lambda?  x => expr
        if (this.peek(1).type === TokenType.ARROW) {
          return this.parseSingleParamLambda();
        }
        this.advance();
        return { kind: 'Identifier', name: tok.value, pos } satisfies Identifier;
      }

      // Some keywords can appear as identifiers in expression context (e.g. send, emit)
      case TokenType.SEND:
      case TokenType.EMIT:
      case TokenType.RETRY:
      case TokenType.WAIT:
        this.advance();
        return { kind: 'Identifier', name: tok.value, pos } satisfies Identifier;

      default:
        throw this.error(`Unexpected token in expression: ${tok.type} ('${tok.value}')`, pos);
    }
  }

  // ─── Template literal parser ──────────────────────────────────────────────

  private parseTemplate(raw: string, pos: Position): TemplateLiteral {
    const parts: TemplatePart[] = [];
    let i = 0;
    let textBuf = '';

    while (i < raw.length) {
      if (raw[i] === '{') {
        if (textBuf) { parts.push({ type: 'text', text: textBuf }); textBuf = ''; }
        let depth = 1;
        i++; // skip {
        let exprSrc = '';
        while (i < raw.length && depth > 0) {
          if (raw[i] === '{') depth++;
          else if (raw[i] === '}') { depth--; if (depth === 0) { i++; break; } }
          if (depth > 0) exprSrc += raw[i];
          i++;
        }
        // Parse the inner expression using the already-imported Lexer
        const innerTokens = new Lexer(exprSrc, '<template>').tokenize();
        const innerParser = new Parser(innerTokens, exprSrc, '<template>');
        const exprNode = innerParser.parseExpression();
        parts.push({ type: 'expr', expr: exprNode });
      } else {
        textBuf += raw[i];
        i++;
      }
    }

    if (textBuf) parts.push({ type: 'text', text: textBuf });
    return { kind: 'TemplateLiteral', parts, raw, pos };
  }

  // ─── Array literal ────────────────────────────────────────────────────────

  private parseArrayLiteral(): ArrayLiteral {
    const pos = this.currentPos();
    this.expect(TokenType.LBRACKET);
    const elements: Expression[] = [];

    this.skipNewlines();
    while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
      elements.push(this.parseExpression());
      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(TokenType.RBRACKET);
    return { kind: 'ArrayLiteral', elements, pos };
  }

  // ─── Dict literal { key: val, ... } ──────────────────────────────────────

  private parseDictLiteral(): DictLiteral {
    const pos = this.currentPos();
    this.expect(TokenType.LBRACE);
    const entries: DictEntry[] = [];

    this.skipNewlines();
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      let key: string | Expression;

      if (this.check(TokenType.IDENTIFIER)) {
        key = this.advance().value;
      } else if (this.check(TokenType.STRING) || this.check(TokenType.TEMPLATE)) {
        key = this.parsePrimary();
      } else {
        throw this.error('Expected dict key (identifier or string)');
      }

      this.expect(TokenType.COLON);
      const value = this.parseExpression();
      entries.push({ key, value });

      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE);
    return { kind: 'DictLiteral', entries, pos };
  }

  // ─── ( expr ) or ( params ) => expr  ────────────────────────────────────

  private parseParenOrLambda(): Expression {
    const pos = this.currentPos();

    // Try to detect lambda: check if after matching parens we get =>
    if (this.isLambdaAhead()) {
      return this.parseParenLambda(pos);
    }

    this.expect(TokenType.LPAREN);
    const expr = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return expr;
  }

  private isLambdaAhead(): boolean {
    // Quick heuristic: scan for => after matching parens
    let depth = 0;
    let i = this.pos;
    while (i < this.tokens.length) {
      const t = this.tokens[i];
      if (t.type === TokenType.LPAREN) depth++;
      else if (t.type === TokenType.RPAREN) {
        depth--;
        if (depth === 0) {
          // Next non-newline token?
          let j = i + 1;
          while (j < this.tokens.length && this.tokens[j].type === TokenType.NEWLINE) j++;
          return this.tokens[j]?.type === TokenType.ARROW;
        }
      } else if (t.type === TokenType.EOF) break;
      i++;
    }
    return false;
  }

  private parseParenLambda(pos: Position): LambdaExpr {
    const isAsync = this.match(TokenType.ASYNC);
    this.expect(TokenType.LPAREN);
    const params = this.parseParamList();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.ARROW);
    const body = this.check(TokenType.LBRACE)
      ? this.parseBlock()
      : this.parseExpression();
    return { kind: 'LambdaExpr', params, body, isAsync, pos };
  }

  private parseSingleParamLambda(): LambdaExpr {
    const pos = this.currentPos();
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.ARROW);
    const param: Param = { kind: 'Param', name, isOptional: false, pos };
    const body = this.check(TokenType.LBRACE) ? this.parseBlock() : this.parseExpression();
    return { kind: 'LambdaExpr', params: [param], body, isAsync: false, pos };
  }

  private parseFnLiteralAsLambda(): LambdaExpr {
    const pos = this.currentPos();
    const isAsync = this.match(TokenType.ASYNC);
    this.expect(TokenType.FN);
    this.expect(TokenType.LPAREN);
    const params = this.parseParamList();
    this.expect(TokenType.RPAREN);
    const body = this.parseBlock();
    return { kind: 'LambdaExpr', params, body, isAsync, pos };
  }

  // ─── new Constructor(...) ────────────────────────────────────────────────

  private parseNewExpr(): NewExpr {
    const pos = this.currentPos();
    this.expect(TokenType.NEW);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);
    const args = this.parseArgList();
    this.expect(TokenType.RPAREN);
    return { kind: 'NewExpr', constructor: name, args, pos };
  }

  // ─── Statement terminator ─────────────────────────────────────────────────

  private consumeStatementEnd(): void {
    // Optional newline/semicolon
    if (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }
}

// ─── Duration helpers ─────────────────────────────────────────────────────────

export function durationToMs(amount: number, unit: string): number {
  switch (unit) {
    case 'ms': return amount;
    case 's':  return amount * 1000;
    case 'm':  return amount * 60_000;
    case 'h':  return amount * 3_600_000;
    case 'd':  return amount * 86_400_000;
    case 'w':  return amount * 604_800_000;
    default:   return amount;
  }
}

// ─── Convenience function ────────────────────────────────────────────────────

import { Lexer } from '../lexer/index.js';

export function parse(src: string, filename?: string): Program {
  const lexer = new Lexer(src, filename);
  const tokens = lexer.tokenize();
  return new Parser(tokens, src, filename).parse();
}
