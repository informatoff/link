"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.ParseError = void 0;
exports.durationToMs = durationToMs;
exports.parse = parse;
const index_js_1 = require("../lexer/index.js");
// ─── Parse Error ──────────────────────────────────────────────────────────────
class ParseError extends Error {
    pos;
    filename;
    src;
    constructor(message, pos, filename = '<anonymous>', src) {
        super(message);
        this.pos = pos;
        this.filename = filename;
        this.src = src;
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
// ─── Parser ───────────────────────────────────────────────────────────────────
class Parser {
    tokens;
    pos = 0;
    filename;
    src;
    constructor(tokens, src = '', filename = '<anonymous>') {
        this.tokens = tokens;
        this.src = src;
        this.filename = filename;
    }
    // ─── Token navigation ──────────────────────────────────────────────────────
    peek(offset = 0) {
        const idx = this.pos + offset;
        return this.tokens[idx] ?? this.tokens[this.tokens.length - 1];
    }
    advance() {
        const tok = this.tokens[this.pos];
        if (tok.type !== index_js_1.TokenType.EOF)
            this.pos++;
        return tok;
    }
    check(type) {
        return this.currentType() === type;
    }
    currentType() {
        return this.peek().type;
    }
    match(...types) {
        for (const t of types) {
            if (this.check(t)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    expect(type, msg) {
        if (this.check(type))
            return this.advance();
        const tok = this.peek();
        throw new ParseError(msg ?? `Expected ${type}, got ${tok.type} ('${tok.value}')`, tok.pos, this.filename, this.src);
    }
    skipNewlines() {
        while (this.check(index_js_1.TokenType.NEWLINE) || this.check(index_js_1.TokenType.SEMICOLON)) {
            this.advance();
        }
    }
    currentPos() {
        return this.peek().pos;
    }
    error(msg, pos) {
        return new ParseError(msg, pos ?? this.currentPos(), this.filename, this.src);
    }
    /**
     * Lookahead: { IDENTIFIER : ... } or { STRING : ... } → dict literal
     * Otherwise → block
     */
    looksLikeDict() {
        // { } empty — treat as block (ambiguous, prefer block)
        if (this.peek(1).type === index_js_1.TokenType.RBRACE)
            return false;
        // { IDENTIFIER : ... } or { STRING : ... }
        const second = this.peek(1).type;
        const third = this.peek(2).type;
        if ((second === index_js_1.TokenType.IDENTIFIER || second === index_js_1.TokenType.STRING) &&
            third === index_js_1.TokenType.COLON)
            return true;
        return false;
    }
    // ─── Public API ────────────────────────────────────────────────────────────
    parse() {
        const pos = this.currentPos();
        const body = [];
        this.skipNewlines();
        while (!this.check(index_js_1.TokenType.EOF)) {
            body.push(this.parseStatement());
            this.skipNewlines();
        }
        return { kind: 'Program', body, pos };
    }
    // ─── Statements ────────────────────────────────────────────────────────────
    parseStatement() {
        this.skipNewlines();
        const tok = this.peek();
        switch (tok.type) {
            case index_js_1.TokenType.IMPORT: return this.parseImport();
            case index_js_1.TokenType.EXPORT: return this.parseExport();
            case index_js_1.TokenType.LET:
            case index_js_1.TokenType.CONST:
            case index_js_1.TokenType.FLOW: return this.parseVarDecl();
            case index_js_1.TokenType.ASYNC:
            case index_js_1.TokenType.FN: return this.parseFnDecl();
            case index_js_1.TokenType.STRUCT: return this.parseStructDecl();
            case index_js_1.TokenType.CLASS: return this.parseClassDecl();
            case index_js_1.TokenType.EVENT: return this.parseEventDecl();
            case index_js_1.TokenType.CHANNEL: return this.parseChannelDecl();
            case index_js_1.TokenType.LISTEN: return this.parseListenStmt();
            case index_js_1.TokenType.ON: return this.parseOnStmt();
            case index_js_1.TokenType.ROUTE: return this.parseRouteStmt();
            case index_js_1.TokenType.HOOK: return this.parseHookStmt();
            case index_js_1.TokenType.EMIT: return this.parseEmitStmt();
            case index_js_1.TokenType.WAIT: return this.parseWaitStmt();
            case index_js_1.TokenType.IF: return this.parseIfStmt();
            case index_js_1.TokenType.FOR: return this.parseForStmt();
            case index_js_1.TokenType.WHILE: return this.parseWhileStmt();
            case index_js_1.TokenType.LOOP: return this.parseLoopStmt();
            case index_js_1.TokenType.TRY: return this.parseTryStmt();
            case index_js_1.TokenType.RETURN: return this.parseReturnStmt();
            case index_js_1.TokenType.BREAK: return this.parseBreakStmt();
            case index_js_1.TokenType.CONTINUE: return this.parseContinueStmt();
            case index_js_1.TokenType.THROW: return this.parseThrowStmt();
            case index_js_1.TokenType.LBRACE: return this.looksLikeDict() ? this.parseExprStmt() : this.parseBlock();
            default: return this.parseExprStmt();
        }
    }
    // ─── import "module" [as alias] ────────────────────────────────────────────
    parseImport() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.IMPORT);
        const pathTok = this.expect(index_js_1.TokenType.STRING, 'Expected module path string after import');
        let alias;
        if (this.check(index_js_1.TokenType.IDENTIFIER) && this.peek().value === 'as') {
            this.advance(); // consume 'as'
            alias = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        }
        this.consumeStatementEnd();
        return { kind: 'ImportDecl', path: pathTok.value, alias, pos };
    }
    // ─── export decl ───────────────────────────────────────────────────────────
    parseExport() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.EXPORT);
        const inner = this.parseStatement();
        if (inner.kind !== 'FnDecl' &&
            inner.kind !== 'VarDecl' &&
            inner.kind !== 'StructDecl' &&
            inner.kind !== 'ClassDecl') {
            throw this.error('export must be followed by fn, let, const, struct, or class');
        }
        return { kind: 'ExportDecl', declaration: inner, pos };
    }
    // ─── Variable declarations: let / const / flow ─────────────────────────────
    parseVarDecl() {
        const pos = this.currentPos();
        const kwTok = this.advance(); // let | const | flow
        const varKind = kwTok.value;
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        let init;
        if (this.match(index_js_1.TokenType.ASSIGN)) {
            init = this.parseExpression();
        }
        this.consumeStatementEnd();
        return { kind: 'VarDecl', varKind, name, init, pos };
    }
    // ─── Function declarations ─────────────────────────────────────────────────
    parseFnDecl(allowAnonymous = false) {
        const pos = this.currentPos();
        const isAsync = this.match(index_js_1.TokenType.ASYNC);
        this.expect(index_js_1.TokenType.FN);
        let name;
        if (allowAnonymous && !this.check(index_js_1.TokenType.IDENTIFIER)) {
            name = '<anonymous>';
        }
        else {
            name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        }
        this.expect(index_js_1.TokenType.LPAREN);
        const params = this.parseParamList();
        this.expect(index_js_1.TokenType.RPAREN);
        const body = this.parseBlock();
        return { kind: 'FnDecl', name, params, body, isAsync, pos };
    }
    // ─── Struct ────────────────────────────────────────────────────────────────
    parseStructDecl() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.STRUCT);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.LBRACE);
        this.skipNewlines();
        const fields = [];
        while (!this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            const fpos = this.currentPos();
            const fname = this.expect(index_js_1.TokenType.IDENTIFIER).value;
            let typeAnnotation;
            let defaultValue;
            if (this.match(index_js_1.TokenType.COLON)) {
                if (this.check(index_js_1.TokenType.IDENTIFIER)) {
                    typeAnnotation = this.advance().value;
                }
            }
            if (this.match(index_js_1.TokenType.ASSIGN)) {
                defaultValue = this.parseExpression();
            }
            fields.push({ kind: 'StructField', name: fname, typeAnnotation, defaultValue, pos: fpos });
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACE);
        return { kind: 'StructDecl', name, fields, pos };
    }
    // ─── Class ─────────────────────────────────────────────────────────────────
    parseClassDecl() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.CLASS);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        let superClass;
        if (this.match(index_js_1.TokenType.EXTENDS)) {
            superClass = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        }
        this.expect(index_js_1.TokenType.LBRACE);
        this.skipNewlines();
        const members = [];
        while (!this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            const stmt = this.parseStatement();
            if (stmt.kind === 'FnDecl' || stmt.kind === 'VarDecl') {
                members.push(stmt);
            }
            else {
                throw this.error(`Only fn and variable declarations allowed in class body, got ${stmt.kind}`);
            }
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACE);
        return { kind: 'ClassDecl', name, superClass, members, pos };
    }
    // ─── event user_joined ─────────────────────────────────────────────────────
    parseEventDecl() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.EVENT);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.consumeStatementEnd();
        return { kind: 'EventDecl', name, pos };
    }
    // ─── channel bot = link telegram("TOKEN") ──────────────────────────────────
    parseChannelDecl() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.CHANNEL);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.ASSIGN);
        this.expect(index_js_1.TokenType.LINK);
        const platform = this.expect(index_js_1.TokenType.IDENTIFIER).value; // telegram | discord | vk
        this.expect(index_js_1.TokenType.LPAREN);
        const token = this.parseExpression();
        this.expect(index_js_1.TokenType.RPAREN);
        this.consumeStatementEnd();
        return { kind: 'ChannelDecl', name, platform, token, pos };
    }
    // ─── listen bot, bot2 { ... } ──────────────────────────────────────────────
    parseListenStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.LISTEN);
        const channels = [];
        channels.push(this.expect(index_js_1.TokenType.IDENTIFIER).value);
        while (this.match(index_js_1.TokenType.COMMA)) {
            channels.push(this.expect(index_js_1.TokenType.IDENTIFIER).value);
        }
        const body = this.parseBlock();
        return { kind: 'ListenStmt', channels, body, pos };
    }
    // ─── on message(msg) { ... } | on message(msg) => expr ─────────────────────
    parseOnStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.ON);
        const event = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.LPAREN);
        const params = this.parseParamList();
        this.expect(index_js_1.TokenType.RPAREN);
        let body;
        if (this.match(index_js_1.TokenType.ARROW)) {
            body = this.parseExpression();
            this.consumeStatementEnd();
        }
        else {
            body = this.parseBlock();
        }
        return { kind: 'OnStmt', event, params, body, pos };
    }
    // ─── route "/ban {user} {reason?}" { ... } ─────────────────────────────────
    parseRouteStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.ROUTE);
        // Pattern is a string or template literal token — we keep it raw for matching
        const patTok = this.peek();
        let pattern;
        if (patTok.type === index_js_1.TokenType.STRING || patTok.type === index_js_1.TokenType.TEMPLATE) {
            pattern = patTok.value;
            this.advance();
        }
        else {
            throw this.error('Expected route pattern string');
        }
        // Parse route params from pattern: {user}, {reason?}
        const routeParams = this.extractRouteParams(pattern);
        // Parse body — may include require clauses
        this.expect(index_js_1.TokenType.LBRACE);
        this.skipNewlines();
        const requires = [];
        const bodyStmts = [];
        while (!this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            if (this.check(index_js_1.TokenType.REQUIRE)) {
                requires.push(this.parseRequireClause());
            }
            else {
                bodyStmts.push(this.parseStatement());
            }
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACE);
        const body = { kind: 'Block', body: bodyStmts, pos };
        return { kind: 'RouteStmt', pattern, routeParams, body, requires, pos };
    }
    extractRouteParams(pattern) {
        const params = [];
        const re = /\{(\w+)(\?)?\}/g;
        let m;
        while ((m = re.exec(pattern)) !== null) {
            params.push({ name: m[1], isOptional: m[2] === '?' });
        }
        return params;
    }
    // ─── require permission: "admin" ───────────────────────────────────────────
    parseRequireClause() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.REQUIRE);
        const key = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.COLON);
        const value = this.parseExpression();
        this.consumeStatementEnd();
        return { kind: 'RequireClause', key, value, pos };
    }
    // ─── hook on_start { ... } ─────────────────────────────────────────────────
    parseHookStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.HOOK);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        let params = [];
        if (this.match(index_js_1.TokenType.LPAREN)) {
            params = this.parseParamList();
            this.expect(index_js_1.TokenType.RPAREN);
        }
        const body = this.parseBlock();
        return { kind: 'HookStmt', name, params, body, pos };
    }
    // ─── emit user_joined(data) ────────────────────────────────────────────────
    parseEmitStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.EMIT);
        const event = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.LPAREN);
        const args = this.parseArgList();
        this.expect(index_js_1.TokenType.RPAREN);
        this.consumeStatementEnd();
        return { kind: 'EmitStmt', event, args, pos };
    }
    // ─── wait 500ms ────────────────────────────────────────────────────────────
    parseWaitStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.WAIT);
        const durTok = this.peek();
        if (durTok.type !== index_js_1.TokenType.DURATION) {
            throw this.error('Expected duration literal after wait (e.g. 500ms, 5s)');
        }
        this.advance();
        const dur = durTok;
        const duration = {
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
    parseIfStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.IF);
        const condition = this.parseExpression();
        const consequent = this.parseBlock();
        const alternates = [];
        let alternate;
        while (this.check(index_js_1.TokenType.ELIF)) {
            const epos = this.currentPos();
            this.advance();
            const econ = this.parseExpression();
            const ebody = this.parseBlock();
            alternates.push({ kind: 'ElifClause', condition: econ, consequent: ebody, pos: epos });
        }
        if (this.match(index_js_1.TokenType.ELSE)) {
            alternate = this.parseBlock();
        }
        return { kind: 'IfStmt', condition, consequent, alternates, alternate, pos };
    }
    // ─── for x in list { } ────────────────────────────────────────────────────
    parseForStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.FOR);
        const variable = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.IN);
        const iterable = this.parseExpression();
        const body = this.parseBlock();
        return { kind: 'ForStmt', variable, iterable, body, pos };
    }
    // ─── while cond { } ────────────────────────────────────────────────────────
    parseWhileStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.WHILE);
        const condition = this.parseExpression();
        const body = this.parseBlock();
        return { kind: 'WhileStmt', condition, body, pos };
    }
    // ─── loop { } ──────────────────────────────────────────────────────────────
    parseLoopStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.LOOP);
        const body = this.parseBlock();
        return { kind: 'LoopStmt', body, pos };
    }
    // ─── try / catch / finally ─────────────────────────────────────────────────
    parseTryStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.TRY);
        const body = this.parseBlock();
        let catchClause;
        let finallyClause;
        if (this.match(index_js_1.TokenType.CATCH)) {
            this.expect(index_js_1.TokenType.LPAREN);
            const param = this.expect(index_js_1.TokenType.IDENTIFIER).value;
            this.expect(index_js_1.TokenType.RPAREN);
            const catchBody = this.parseBlock();
            catchClause = { param, body: catchBody };
        }
        if (this.match(index_js_1.TokenType.FINALLY)) {
            finallyClause = this.parseBlock();
        }
        return { kind: 'TryStmt', body, catchClause, finallyClause, pos };
    }
    // ─── return / break / continue / throw ─────────────────────────────────────
    parseReturnStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.RETURN);
        let value;
        if (!this.check(index_js_1.TokenType.NEWLINE) && !this.check(index_js_1.TokenType.SEMICOLON) && !this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            value = this.parseExpression();
        }
        this.consumeStatementEnd();
        return { kind: 'ReturnStmt', value, pos };
    }
    parseBreakStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.BREAK);
        this.consumeStatementEnd();
        return { kind: 'BreakStmt', pos };
    }
    parseContinueStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.CONTINUE);
        this.consumeStatementEnd();
        return { kind: 'ContinueStmt', pos };
    }
    parseThrowStmt() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.THROW);
        const value = this.parseExpression();
        this.consumeStatementEnd();
        return { kind: 'ThrowStmt', value, pos };
    }
    parseExprStmt() {
        const pos = this.currentPos();
        const expr = this.parseExpression();
        this.consumeStatementEnd();
        return { kind: 'ExprStmt', expr, pos };
    }
    // ─── Block { ... } ────────────────────────────────────────────────────────
    parseBlock() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.LBRACE);
        this.skipNewlines();
        const body = [];
        while (!this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            body.push(this.parseStatement());
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACE);
        return { kind: 'Block', body, pos };
    }
    // ─── Parameter list ────────────────────────────────────────────────────────
    parseParamList() {
        const params = [];
        if (this.check(index_js_1.TokenType.RPAREN))
            return params;
        params.push(this.parseParam());
        while (this.match(index_js_1.TokenType.COMMA)) {
            if (this.check(index_js_1.TokenType.RPAREN))
                break; // trailing comma
            params.push(this.parseParam());
        }
        return params;
    }
    parseParam() {
        const pos = this.currentPos();
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        let defaultValue;
        let isOptional = false;
        if (this.match(index_js_1.TokenType.QUESTION)) {
            isOptional = true;
        }
        if (this.match(index_js_1.TokenType.ASSIGN)) {
            defaultValue = this.parseExpression();
            isOptional = true;
        }
        return { kind: 'Param', name, defaultValue, isOptional, pos };
    }
    // ─── Argument list ─────────────────────────────────────────────────────────
    parseArgList() {
        const args = [];
        if (this.check(index_js_1.TokenType.RPAREN))
            return args;
        args.push(this.parseArg());
        while (this.match(index_js_1.TokenType.COMMA)) {
            if (this.check(index_js_1.TokenType.RPAREN))
                break;
            args.push(this.parseArg());
        }
        return args;
    }
    parseArg() {
        // Named arg: label: value  (only if next two tokens are IDENTIFIER COLON)
        if (this.check(index_js_1.TokenType.IDENTIFIER) &&
            this.peek(1).type === index_js_1.TokenType.COLON) {
            const label = this.advance().value;
            this.advance(); // colon
            const value = this.parseExpression();
            return { label, value };
        }
        return { value: this.parseExpression() };
    }
    // ─── Expression parsing (Pratt) ───────────────────────────────────────────
    parseExpression() {
        return this.parsePrec(0 /* Prec.NONE */);
    }
    parsePrec(minPrec) {
        let left = this.parseUnary();
        while (true) {
            // Check for pipe operator |>
            if (this.check(index_js_1.TokenType.PIPE) && 2 /* Prec.PIPE */ > minPrec) {
                const pos = this.currentPos();
                this.advance();
                const fn = this.parseUnary();
                left = { kind: 'PipeExpr', left, fn, pos };
                continue;
            }
            // Check for retry operator ~>
            if (this.check(index_js_1.TokenType.RETRY_OP) && 1 /* Prec.ASSIGN */ < minPrec === false) {
                const pos = this.currentPos();
                this.advance(); // ~>
                this.expect(index_js_1.TokenType.RETRY, 'Expected retry(...) after ~>');
                this.expect(index_js_1.TokenType.LPAREN, 'Expected ( after retry');
                const timesTok = this.expect(index_js_1.TokenType.INTEGER, 'Expected retry count');
                const times = parseInt(timesTok.value, 10);
                const options = [];
                while (this.match(index_js_1.TokenType.COMMA)) {
                    if (this.check(index_js_1.TokenType.RPAREN))
                        break;
                    const key = this.expect(index_js_1.TokenType.IDENTIFIER).value;
                    this.expect(index_js_1.TokenType.COLON);
                    const val = this.parseExpression();
                    options.push({ key, value: val });
                }
                this.expect(index_js_1.TokenType.RPAREN);
                left = { kind: 'RetryExpr', expr: left, times, options, pos };
                continue;
            }
            // Ternary ?:
            if (this.check(index_js_1.TokenType.QUESTION) && 3 /* Prec.TERNARY */ > minPrec) {
                const pos = this.currentPos();
                this.advance();
                const consequent = this.parsePrec(0 /* Prec.NONE */);
                this.expect(index_js_1.TokenType.COLON, 'Expected : in ternary expression');
                const alternate = this.parsePrec(0 /* Prec.NONE */);
                left = { kind: 'TernaryExpr', condition: left, consequent, alternate, pos };
                continue;
            }
            const op = this.getBinaryOp();
            if (op === null)
                break;
            const [opPrec, rightAssoc] = this.getPrec(op);
            if (opPrec <= minPrec)
                break;
            const pos = left.pos;
            this.advance(); // consume operator
            // Assignment operators are right-associative
            if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=') {
                const value = this.parsePrec(0 /* Prec.NONE */);
                left = {
                    kind: 'AssignExpr',
                    op: op,
                    target: left,
                    value,
                    pos,
                };
            }
            else {
                const nextPrec = rightAssoc ? opPrec - 1 : opPrec;
                const right = this.parsePrec(nextPrec);
                left = {
                    kind: 'BinaryExpr',
                    op: op,
                    left,
                    right,
                    pos,
                };
            }
        }
        return left;
    }
    getBinaryOp() {
        switch (this.currentType()) {
            case index_js_1.TokenType.PLUS: return '+';
            case index_js_1.TokenType.MINUS: return '-';
            case index_js_1.TokenType.STAR: return '*';
            case index_js_1.TokenType.SLASH: return '/';
            case index_js_1.TokenType.PERCENT: return '%';
            case index_js_1.TokenType.POWER: return '**';
            case index_js_1.TokenType.EQ: return '==';
            case index_js_1.TokenType.NEQ: return '!=';
            case index_js_1.TokenType.LT: return '<';
            case index_js_1.TokenType.GT: return '>';
            case index_js_1.TokenType.LTE: return '<=';
            case index_js_1.TokenType.GTE: return '>=';
            case index_js_1.TokenType.AND: return '&&';
            case index_js_1.TokenType.OR: return '||';
            case index_js_1.TokenType.NULLISH_COAL: return '??';
            case index_js_1.TokenType.ASSIGN: return '=';
            case index_js_1.TokenType.PLUS_ASSIGN: return '+=';
            case index_js_1.TokenType.MINUS_ASSIGN: return '-=';
            case index_js_1.TokenType.STAR_ASSIGN: return '*=';
            case index_js_1.TokenType.SLASH_ASSIGN: return '/=';
            default: return null;
        }
    }
    getPrec(op) {
        switch (op) {
            case '=':
            case '+=':
            case '-=':
            case '*=':
            case '/=':
                return [1 /* Prec.ASSIGN */, true];
            case '||':
            case '??':
                return [4 /* Prec.OR */, false];
            case '&&':
                return [5 /* Prec.AND */, false];
            case '==':
            case '!=':
                return [6 /* Prec.EQUALITY */, false];
            case '<':
            case '>':
            case '<=':
            case '>=':
                return [7 /* Prec.COMPARISON */, false];
            case '+':
            case '-':
                return [8 /* Prec.ADDITIVE */, false];
            case '*':
            case '/':
            case '%':
                return [9 /* Prec.MULT */, false];
            case '**':
                return [10 /* Prec.POWER */, true]; // right-associative
            default:
                return [0 /* Prec.NONE */, false];
        }
    }
    // ─── Unary ────────────────────────────────────────────────────────────────
    parseUnary() {
        const pos = this.currentPos();
        if (this.check(index_js_1.TokenType.NOT)) {
            this.advance();
            return { kind: 'UnaryExpr', op: '!', operand: this.parseUnary(), pos };
        }
        if (this.check(index_js_1.TokenType.MINUS)) {
            this.advance();
            return { kind: 'UnaryExpr', op: '-', operand: this.parseUnary(), pos };
        }
        if (this.check(index_js_1.TokenType.AWAIT)) {
            this.advance();
            const expr = this.parseUnary();
            return { kind: 'AwaitExpr', expr, pos };
        }
        return this.parseCall();
    }
    // ─── Call / member / index expressions ────────────────────────────────────
    parseCall() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.check(index_js_1.TokenType.LPAREN)) {
                const pos = this.currentPos();
                this.advance();
                const args = this.parseArgList();
                this.expect(index_js_1.TokenType.RPAREN);
                expr = { kind: 'CallExpr', callee: expr, args, pos };
            }
            else if (this.check(index_js_1.TokenType.DOT)) {
                const pos = this.currentPos();
                this.advance();
                const prop = this.expect(index_js_1.TokenType.IDENTIFIER).value;
                expr = { kind: 'MemberExpr', object: expr, property: prop, optional: false, pos };
            }
            else if (this.check(index_js_1.TokenType.OPTIONAL_CHAIN)) {
                const pos = this.currentPos();
                this.advance();
                const prop = this.expect(index_js_1.TokenType.IDENTIFIER).value;
                expr = { kind: 'MemberExpr', object: expr, property: prop, optional: true, pos };
            }
            else if (this.check(index_js_1.TokenType.LBRACKET)) {
                const pos = this.currentPos();
                this.advance();
                const index = this.parseExpression();
                this.expect(index_js_1.TokenType.RBRACKET);
                expr = { kind: 'IndexExpr', object: expr, index, pos };
            }
            else {
                break;
            }
        }
        return expr;
    }
    // ─── Primary expressions ─────────────────────────────────────────────────
    parsePrimary() {
        const tok = this.peek();
        const pos = tok.pos;
        switch (tok.type) {
            case index_js_1.TokenType.INTEGER:
                this.advance();
                return { kind: 'IntegerLiteral', value: parseInt(tok.value, 10), pos };
            case index_js_1.TokenType.FLOAT:
                this.advance();
                return { kind: 'FloatLiteral', value: parseFloat(tok.value), pos };
            case index_js_1.TokenType.DURATION: {
                this.advance();
                const dt = tok;
                return {
                    kind: 'DurationLiteral',
                    amount: dt.amount,
                    unit: dt.unit,
                    ms: durationToMs(dt.amount, dt.unit),
                    pos,
                };
            }
            case index_js_1.TokenType.STRING:
                this.advance();
                return { kind: 'StringLiteral', value: tok.value, pos };
            case index_js_1.TokenType.TEMPLATE:
                this.advance();
                return this.parseTemplate(tok.value, pos);
            case index_js_1.TokenType.BOOL:
                this.advance();
                return { kind: 'BoolLiteral', value: tok.value === 'true', pos };
            case index_js_1.TokenType.NULL:
                this.advance();
                return { kind: 'NullLiteral', pos };
            case index_js_1.TokenType.LBRACKET:
                return this.parseArrayLiteral();
            case index_js_1.TokenType.LBRACE:
                return this.parseDictLiteral();
            case index_js_1.TokenType.LPAREN:
                return this.parseParenOrLambda();
            case index_js_1.TokenType.NEW:
                return this.parseNewExpr();
            case index_js_1.TokenType.ASYNC:
            case index_js_1.TokenType.FN:
                return this.parseFnLiteralAsLambda();
            case index_js_1.TokenType.IDENTIFIER: {
                // Peek ahead: is this a single-param lambda?  x => expr
                if (this.peek(1).type === index_js_1.TokenType.ARROW) {
                    return this.parseSingleParamLambda();
                }
                this.advance();
                return { kind: 'Identifier', name: tok.value, pos };
            }
            // Some keywords can appear as identifiers in expression context (e.g. send, emit)
            case index_js_1.TokenType.SEND:
            case index_js_1.TokenType.EMIT:
            case index_js_1.TokenType.RETRY:
            case index_js_1.TokenType.WAIT:
                this.advance();
                return { kind: 'Identifier', name: tok.value, pos };
            default:
                throw this.error(`Unexpected token in expression: ${tok.type} ('${tok.value}')`, pos);
        }
    }
    // ─── Template literal parser ──────────────────────────────────────────────
    parseTemplate(raw, pos) {
        const parts = [];
        let i = 0;
        let textBuf = '';
        while (i < raw.length) {
            if (raw[i] === '{') {
                if (textBuf) {
                    parts.push({ type: 'text', text: textBuf });
                    textBuf = '';
                }
                let depth = 1;
                i++; // skip {
                let exprSrc = '';
                while (i < raw.length && depth > 0) {
                    if (raw[i] === '{')
                        depth++;
                    else if (raw[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            i++;
                            break;
                        }
                    }
                    if (depth > 0)
                        exprSrc += raw[i];
                    i++;
                }
                // Parse the inner expression using the already-imported Lexer
                const innerTokens = new index_js_2.Lexer(exprSrc, '<template>').tokenize();
                const innerParser = new Parser(innerTokens, exprSrc, '<template>');
                const exprNode = innerParser.parseExpression();
                parts.push({ type: 'expr', expr: exprNode });
            }
            else {
                textBuf += raw[i];
                i++;
            }
        }
        if (textBuf)
            parts.push({ type: 'text', text: textBuf });
        return { kind: 'TemplateLiteral', parts, raw, pos };
    }
    // ─── Array literal ────────────────────────────────────────────────────────
    parseArrayLiteral() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.LBRACKET);
        const elements = [];
        this.skipNewlines();
        while (!this.check(index_js_1.TokenType.RBRACKET) && !this.check(index_js_1.TokenType.EOF)) {
            elements.push(this.parseExpression());
            this.skipNewlines();
            if (!this.match(index_js_1.TokenType.COMMA))
                break;
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACKET);
        return { kind: 'ArrayLiteral', elements, pos };
    }
    // ─── Dict literal { key: val, ... } ──────────────────────────────────────
    parseDictLiteral() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.LBRACE);
        const entries = [];
        this.skipNewlines();
        while (!this.check(index_js_1.TokenType.RBRACE) && !this.check(index_js_1.TokenType.EOF)) {
            let key;
            if (this.check(index_js_1.TokenType.IDENTIFIER)) {
                key = this.advance().value;
            }
            else if (this.check(index_js_1.TokenType.STRING) || this.check(index_js_1.TokenType.TEMPLATE)) {
                key = this.parsePrimary();
            }
            else {
                throw this.error('Expected dict key (identifier or string)');
            }
            this.expect(index_js_1.TokenType.COLON);
            const value = this.parseExpression();
            entries.push({ key, value });
            this.skipNewlines();
            if (!this.match(index_js_1.TokenType.COMMA))
                break;
            this.skipNewlines();
        }
        this.expect(index_js_1.TokenType.RBRACE);
        return { kind: 'DictLiteral', entries, pos };
    }
    // ─── ( expr ) or ( params ) => expr  ────────────────────────────────────
    parseParenOrLambda() {
        const pos = this.currentPos();
        // Try to detect lambda: check if after matching parens we get =>
        if (this.isLambdaAhead()) {
            return this.parseParenLambda(pos);
        }
        this.expect(index_js_1.TokenType.LPAREN);
        const expr = this.parseExpression();
        this.expect(index_js_1.TokenType.RPAREN);
        return expr;
    }
    isLambdaAhead() {
        // Quick heuristic: scan for => after matching parens
        let depth = 0;
        let i = this.pos;
        while (i < this.tokens.length) {
            const t = this.tokens[i];
            if (t.type === index_js_1.TokenType.LPAREN)
                depth++;
            else if (t.type === index_js_1.TokenType.RPAREN) {
                depth--;
                if (depth === 0) {
                    // Next non-newline token?
                    let j = i + 1;
                    while (j < this.tokens.length && this.tokens[j].type === index_js_1.TokenType.NEWLINE)
                        j++;
                    return this.tokens[j]?.type === index_js_1.TokenType.ARROW;
                }
            }
            else if (t.type === index_js_1.TokenType.EOF)
                break;
            i++;
        }
        return false;
    }
    parseParenLambda(pos) {
        const isAsync = this.match(index_js_1.TokenType.ASYNC);
        this.expect(index_js_1.TokenType.LPAREN);
        const params = this.parseParamList();
        this.expect(index_js_1.TokenType.RPAREN);
        this.expect(index_js_1.TokenType.ARROW);
        const body = this.check(index_js_1.TokenType.LBRACE)
            ? this.parseBlock()
            : this.parseExpression();
        return { kind: 'LambdaExpr', params, body, isAsync, pos };
    }
    parseSingleParamLambda() {
        const pos = this.currentPos();
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.ARROW);
        const param = { kind: 'Param', name, isOptional: false, pos };
        const body = this.check(index_js_1.TokenType.LBRACE) ? this.parseBlock() : this.parseExpression();
        return { kind: 'LambdaExpr', params: [param], body, isAsync: false, pos };
    }
    parseFnLiteralAsLambda() {
        const pos = this.currentPos();
        const isAsync = this.match(index_js_1.TokenType.ASYNC);
        this.expect(index_js_1.TokenType.FN);
        this.expect(index_js_1.TokenType.LPAREN);
        const params = this.parseParamList();
        this.expect(index_js_1.TokenType.RPAREN);
        const body = this.parseBlock();
        return { kind: 'LambdaExpr', params, body, isAsync, pos };
    }
    // ─── new Constructor(...) ────────────────────────────────────────────────
    parseNewExpr() {
        const pos = this.currentPos();
        this.expect(index_js_1.TokenType.NEW);
        const name = this.expect(index_js_1.TokenType.IDENTIFIER).value;
        this.expect(index_js_1.TokenType.LPAREN);
        const args = this.parseArgList();
        this.expect(index_js_1.TokenType.RPAREN);
        return { kind: 'NewExpr', constructor: name, args, pos };
    }
    // ─── Statement terminator ─────────────────────────────────────────────────
    consumeStatementEnd() {
        // Optional newline/semicolon
        if (this.check(index_js_1.TokenType.NEWLINE) || this.check(index_js_1.TokenType.SEMICOLON)) {
            this.advance();
        }
    }
}
exports.Parser = Parser;
// ─── Duration helpers ─────────────────────────────────────────────────────────
function durationToMs(amount, unit) {
    switch (unit) {
        case 'ms': return amount;
        case 's': return amount * 1000;
        case 'm': return amount * 60_000;
        case 'h': return amount * 3_600_000;
        case 'd': return amount * 86_400_000;
        case 'w': return amount * 604_800_000;
        default: return amount;
    }
}
// ─── Convenience function ────────────────────────────────────────────────────
const index_js_2 = require("../lexer/index.js");
function parse(src, filename) {
    const lexer = new index_js_2.Lexer(src, filename);
    const tokens = lexer.tokenize();
    return new Parser(tokens, src, filename).parse();
}
//# sourceMappingURL=index.js.map