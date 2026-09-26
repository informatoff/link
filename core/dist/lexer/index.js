"use strict";
/**
 * Link Language Lexer
 * Tokenizes .lk source files into a stream of typed tokens.
 * Supports all Link language constructs including:
 *   - Duration literals (500ms, 5s, 3d, etc.)
 *   - Custom operators: ~> (retry), |> (pipe)
 *   - String interpolation: "Hello, {name}!"
 *   - All keywords: link, listen, on, send, flow, hook, route, event, channel, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.LexerError = exports.TokenType = void 0;
exports.tokenize = tokenize;
var TokenType;
(function (TokenType) {
    // ─── Literals ───────────────────────────────────────────────────────────────
    TokenType["INTEGER"] = "INTEGER";
    TokenType["FLOAT"] = "FLOAT";
    TokenType["DURATION"] = "DURATION";
    TokenType["STRING"] = "STRING";
    TokenType["TEMPLATE"] = "TEMPLATE";
    TokenType["BOOL"] = "BOOL";
    TokenType["NULL"] = "NULL";
    // ─── Identifiers & Keywords ──────────────────────────────────────────────────
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    // Core keywords
    TokenType["LET"] = "LET";
    TokenType["CONST"] = "CONST";
    TokenType["FLOW"] = "FLOW";
    TokenType["FN"] = "FN";
    TokenType["RETURN"] = "RETURN";
    TokenType["IF"] = "IF";
    TokenType["ELSE"] = "ELSE";
    TokenType["ELIF"] = "ELIF";
    TokenType["FOR"] = "FOR";
    TokenType["IN"] = "IN";
    TokenType["WHILE"] = "WHILE";
    TokenType["LOOP"] = "LOOP";
    TokenType["BREAK"] = "BREAK";
    TokenType["CONTINUE"] = "CONTINUE";
    TokenType["IMPORT"] = "IMPORT";
    TokenType["EXPORT"] = "EXPORT";
    TokenType["ASYNC"] = "ASYNC";
    TokenType["AWAIT"] = "AWAIT";
    TokenType["TRY"] = "TRY";
    TokenType["CATCH"] = "CATCH";
    TokenType["FINALLY"] = "FINALLY";
    TokenType["THROW"] = "THROW";
    TokenType["NEW"] = "NEW";
    TokenType["STRUCT"] = "STRUCT";
    TokenType["CLASS"] = "CLASS";
    TokenType["THIS"] = "THIS";
    TokenType["EXTENDS"] = "EXTENDS";
    TokenType["NULL_KW"] = "NULL_KW";
    // Link-specific keywords
    TokenType["LINK"] = "LINK";
    TokenType["LISTEN"] = "LISTEN";
    TokenType["ON"] = "ON";
    TokenType["SEND"] = "SEND";
    TokenType["HOOK"] = "HOOK";
    TokenType["ROUTE"] = "ROUTE";
    TokenType["EMIT"] = "EMIT";
    TokenType["EVENT"] = "EVENT";
    TokenType["CHANNEL"] = "CHANNEL";
    TokenType["REQUIRE"] = "REQUIRE";
    TokenType["WAIT"] = "WAIT";
    TokenType["RETRY"] = "RETRY";
    // ─── Operators ────────────────────────────────────────────────────────────────
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["PERCENT"] = "PERCENT";
    TokenType["POWER"] = "POWER";
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["PLUS_ASSIGN"] = "PLUS_ASSIGN";
    TokenType["MINUS_ASSIGN"] = "MINUS_ASSIGN";
    TokenType["STAR_ASSIGN"] = "STAR_ASSIGN";
    TokenType["SLASH_ASSIGN"] = "SLASH_ASSIGN";
    TokenType["EQ"] = "EQ";
    TokenType["NEQ"] = "NEQ";
    TokenType["LT"] = "LT";
    TokenType["GT"] = "GT";
    TokenType["LTE"] = "LTE";
    TokenType["GTE"] = "GTE";
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    TokenType["PIPE"] = "PIPE";
    TokenType["RETRY_OP"] = "RETRY_OP";
    TokenType["ARROW"] = "ARROW";
    TokenType["OPTIONAL_CHAIN"] = "OPTIONAL_CHAIN";
    TokenType["NULLISH_COAL"] = "NULLISH_COAL";
    // ─── Punctuation ─────────────────────────────────────────────────────────────
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    TokenType["COMMA"] = "COMMA";
    TokenType["DOT"] = "DOT";
    TokenType["COLON"] = "COLON";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["QUESTION"] = "QUESTION";
    TokenType["AT"] = "AT";
    // ─── Special ──────────────────────────────────────────────────────────────────
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
// ─── Keyword map ────────────────────────────────────────────────────────────────
const KEYWORDS = {
    let: TokenType.LET,
    const: TokenType.CONST,
    flow: TokenType.FLOW,
    fn: TokenType.FN,
    return: TokenType.RETURN,
    if: TokenType.IF,
    else: TokenType.ELSE,
    elif: TokenType.ELIF,
    for: TokenType.FOR,
    in: TokenType.IN,
    while: TokenType.WHILE,
    loop: TokenType.LOOP,
    break: TokenType.BREAK,
    continue: TokenType.CONTINUE,
    import: TokenType.IMPORT,
    export: TokenType.EXPORT,
    async: TokenType.ASYNC,
    await: TokenType.AWAIT,
    try: TokenType.TRY,
    catch: TokenType.CATCH,
    finally: TokenType.FINALLY,
    throw: TokenType.THROW,
    new: TokenType.NEW,
    struct: TokenType.STRUCT,
    class: TokenType.CLASS,
    this: TokenType.THIS,
    extends: TokenType.EXTENDS,
    null: TokenType.NULL,
    true: TokenType.BOOL,
    false: TokenType.BOOL,
    // Link-specific
    link: TokenType.LINK,
    listen: TokenType.LISTEN,
    on: TokenType.ON,
    send: TokenType.SEND,
    hook: TokenType.HOOK,
    route: TokenType.ROUTE,
    emit: TokenType.EMIT,
    event: TokenType.EVENT,
    channel: TokenType.CHANNEL,
    require: TokenType.REQUIRE,
    wait: TokenType.WAIT,
    retry: TokenType.RETRY,
};
const DURATION_UNITS = new Set(['ms', 's', 'm', 'h', 'd', 'w']);
// ─── Lexer Error ──────────────────────────────────────────────────────────────
class LexerError extends Error {
    pos;
    source;
    constructor(message, pos, source) {
        super(message);
        this.pos = pos;
        this.source = source;
        this.name = 'LexerError';
    }
}
exports.LexerError = LexerError;
// ─── Lexer ────────────────────────────────────────────────────────────────────
class Lexer {
    source;
    filename;
    pos = 0;
    line = 1;
    column = 1;
    tokens = [];
    constructor(source, filename = '<anonymous>') {
        this.source = source;
        this.filename = filename;
    }
    // ─── Public API ─────────────────────────────────────────────────────────────
    tokenize() {
        while (!this.isEOF()) {
            this.skipWhitespaceAndComments();
            if (this.isEOF())
                break;
            const token = this.nextToken();
            if (token)
                this.tokens.push(token);
        }
        this.tokens.push(this.makeToken(TokenType.EOF, '', ''));
        return this.tokens;
    }
    // ─── Internal helpers ────────────────────────────────────────────────────────
    isEOF(offset = 0) {
        return this.pos + offset >= this.source.length;
    }
    peek(offset = 0) {
        return this.source[this.pos + offset] ?? '\0';
    }
    advance() {
        const ch = this.source[this.pos++];
        if (ch === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        return ch;
    }
    match(expected) {
        if (this.isEOF())
            return false;
        if (this.source.startsWith(expected, this.pos)) {
            for (let i = 0; i < expected.length; i++)
                this.advance();
            return true;
        }
        return false;
    }
    currentPos() {
        return { line: this.line, column: this.column, offset: this.pos };
    }
    makeToken(type, value, raw, pos) {
        return {
            type,
            value,
            raw,
            pos: pos ?? this.currentPos(),
        };
    }
    // ─── Skip whitespace & comments ──────────────────────────────────────────────
    skipWhitespaceAndComments() {
        while (!this.isEOF()) {
            const ch = this.peek();
            // Spaces and tabs
            if (ch === ' ' || ch === '\t' || ch === '\r') {
                this.advance();
                continue;
            }
            // Newlines — emit as tokens for optional semicolon insertion
            if (ch === '\n') {
                const pos = this.currentPos();
                this.advance();
                // Insert NEWLINE token only if last non-whitespace token could end a statement
                const last = this.tokens[this.tokens.length - 1];
                if (last && this.shouldInsertNewline(last.type)) {
                    this.tokens.push({ type: TokenType.NEWLINE, value: '\n', raw: '\n', pos });
                }
                continue;
            }
            // Line comment: //
            if (ch === '/' && this.peek(1) === '/') {
                while (!this.isEOF() && this.peek() !== '\n')
                    this.advance();
                continue;
            }
            // Block comment: /* ... */
            if (ch === '/' && this.peek(1) === '*') {
                this.advance();
                this.advance(); // consume /*
                while (!this.isEOF()) {
                    if (this.peek() === '*' && this.peek(1) === '/') {
                        this.advance();
                        this.advance(); // consume */
                        break;
                    }
                    this.advance();
                }
                continue;
            }
            break;
        }
    }
    shouldInsertNewline(type) {
        return [
            TokenType.IDENTIFIER,
            TokenType.INTEGER,
            TokenType.FLOAT,
            TokenType.DURATION,
            TokenType.STRING,
            TokenType.TEMPLATE,
            TokenType.BOOL,
            TokenType.NULL,
            TokenType.RPAREN,
            TokenType.RBRACKET,
            TokenType.RBRACE,
            TokenType.RETURN,
            TokenType.BREAK,
            TokenType.CONTINUE,
        ].includes(type);
    }
    // ─── Main dispatch ─────────────────────────────────────────────────────────
    nextToken() {
        const startPos = this.currentPos();
        const ch = this.peek();
        // Numbers
        if (this.isDigit(ch))
            return this.readNumber(startPos);
        // Strings
        if (ch === '"' || ch === "'")
            return this.readString(startPos);
        // Identifiers & keywords
        if (this.isAlpha(ch) || ch === '_')
            return this.readIdentifier(startPos);
        // Operators & punctuation
        return this.readOperatorOrPunct(startPos);
    }
    // ─── Number / Duration reader ─────────────────────────────────────────────
    readNumber(startPos) {
        let raw = '';
        let isFloat = false;
        while (!this.isEOF() && this.isDigit(this.peek())) {
            raw += this.advance();
        }
        if (this.peek() === '.' && this.isDigit(this.peek(1))) {
            isFloat = true;
            raw += this.advance(); // consume '.'
            while (!this.isEOF() && this.isDigit(this.peek())) {
                raw += this.advance();
            }
        }
        // Check for duration suffix immediately after number (no space)
        if (!this.isEOF() && this.isAlpha(this.peek())) {
            const suffixStart = this.pos;
            let suffix = '';
            while (!this.isEOF() && this.isAlpha(this.peek())) {
                suffix += this.advance();
            }
            if (DURATION_UNITS.has(suffix)) {
                const fullRaw = raw + suffix;
                const token = {
                    type: TokenType.DURATION,
                    value: fullRaw,
                    raw: fullRaw,
                    pos: startPos,
                    amount: parseFloat(raw),
                    unit: suffix,
                };
                return token;
            }
            // Not a duration — put suffix back by rewinding
            // We can't truly rewind, so we need to lex it as error or part of identifier
            // Instead, we'll treat the full thing as a malformed token
            const badRaw = raw + suffix;
            throw new LexerError(`Invalid number literal: '${badRaw}'`, startPos, this.filename);
        }
        if (isFloat) {
            return { type: TokenType.FLOAT, value: raw, raw, pos: startPos };
        }
        return { type: TokenType.INTEGER, value: raw, raw, pos: startPos };
    }
    // ─── String reader (with interpolation detection) ─────────────────────────
    readString(startPos) {
        const quote = this.advance(); // consume opening " or '
        let value = '';
        let raw = quote;
        let hasInterpolation = false;
        while (!this.isEOF() && this.peek() !== quote) {
            if (this.peek() === '\\') {
                raw += this.advance(); // backslash
                if (!this.isEOF()) {
                    const escaped = this.advance();
                    raw += escaped;
                    switch (escaped) {
                        case 'n':
                            value += '\n';
                            break;
                        case 't':
                            value += '\t';
                            break;
                        case 'r':
                            value += '\r';
                            break;
                        case '"':
                            value += '"';
                            break;
                        case "'":
                            value += "'";
                            break;
                        case '\\':
                            value += '\\';
                            break;
                        case '{':
                            value += '{';
                            break;
                        default: value += '\\' + escaped;
                    }
                }
            }
            else if (this.peek() === '{' && quote === '"') {
                // String interpolation: {expression}
                hasInterpolation = true;
                raw += this.advance(); // consume '{'
                value += '{';
                let depth = 1;
                while (!this.isEOF() && depth > 0) {
                    const c = this.peek();
                    if (c === '{')
                        depth++;
                    if (c === '}')
                        depth--;
                    if (depth > 0 || c !== '}') {
                        raw += c;
                        value += c;
                    }
                    if (depth === 0) {
                        raw += this.advance(); // consume closing '}'
                        value += '}';
                    }
                    else {
                        this.advance();
                    }
                }
            }
            else if (this.peek() === '\n') {
                throw new LexerError('Unterminated string literal', startPos, this.filename);
            }
            else {
                const c = this.advance();
                raw += c;
                value += c;
            }
        }
        if (this.isEOF()) {
            throw new LexerError('Unterminated string literal', startPos, this.filename);
        }
        raw += this.advance(); // consume closing quote
        const type = hasInterpolation ? TokenType.TEMPLATE : TokenType.STRING;
        return { type, value, raw, pos: startPos };
    }
    // ─── Identifier / keyword reader ─────────────────────────────────────────
    readIdentifier(startPos) {
        let raw = '';
        while (!this.isEOF() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
            raw += this.advance();
        }
        // Check for duration: identifiers that are pure duration units preceded by number
        // are handled in readNumber — here we just check for keyword/identifier
        const kwType = KEYWORDS[raw];
        if (kwType !== undefined) {
            // null needs special handling
            if (raw === 'null') {
                return { type: TokenType.NULL, value: raw, raw, pos: startPos };
            }
            return { type: kwType, value: raw, raw, pos: startPos };
        }
        return { type: TokenType.IDENTIFIER, value: raw, raw, pos: startPos };
    }
    // ─── Operators & punctuation ─────────────────────────────────────────────
    readOperatorOrPunct(startPos) {
        const ch = this.peek();
        // Two-char operators first
        const two = this.source.slice(this.pos, this.pos + 2);
        // ~> retry operator
        if (two === '~>') {
            this.advance();
            this.advance();
            return { type: TokenType.RETRY_OP, value: '~>', raw: '~>', pos: startPos };
        }
        // |> pipe operator
        if (two === '|>') {
            this.advance();
            this.advance();
            return { type: TokenType.PIPE, value: '|>', raw: '|>', pos: startPos };
        }
        // => arrow
        if (two === '=>') {
            this.advance();
            this.advance();
            return { type: TokenType.ARROW, value: '=>', raw: '=>', pos: startPos };
        }
        // == equality
        if (two === '==') {
            this.advance();
            this.advance();
            return { type: TokenType.EQ, value: '==', raw: '==', pos: startPos };
        }
        // != not-equal
        if (two === '!=') {
            this.advance();
            this.advance();
            return { type: TokenType.NEQ, value: '!=', raw: '!=', pos: startPos };
        }
        // <= lte
        if (two === '<=') {
            this.advance();
            this.advance();
            return { type: TokenType.LTE, value: '<=', raw: '<=', pos: startPos };
        }
        // >= gte
        if (two === '>=') {
            this.advance();
            this.advance();
            return { type: TokenType.GTE, value: '>=', raw: '>=', pos: startPos };
        }
        // && and
        if (two === '&&') {
            this.advance();
            this.advance();
            return { type: TokenType.AND, value: '&&', raw: '&&', pos: startPos };
        }
        // || or
        if (two === '||') {
            this.advance();
            this.advance();
            return { type: TokenType.OR, value: '||', raw: '||', pos: startPos };
        }
        // += plus assign
        if (two === '+=') {
            this.advance();
            this.advance();
            return { type: TokenType.PLUS_ASSIGN, value: '+=', raw: '+=', pos: startPos };
        }
        // -= minus assign
        if (two === '-=') {
            this.advance();
            this.advance();
            return { type: TokenType.MINUS_ASSIGN, value: '-=', raw: '-=', pos: startPos };
        }
        // *= star assign
        if (two === '*=') {
            this.advance();
            this.advance();
            return { type: TokenType.STAR_ASSIGN, value: '*=', raw: '*=', pos: startPos };
        }
        // /= slash assign
        if (two === '/=') {
            this.advance();
            this.advance();
            return { type: TokenType.SLASH_ASSIGN, value: '/=', raw: '/=', pos: startPos };
        }
        // ** power
        if (two === '**') {
            this.advance();
            this.advance();
            return { type: TokenType.POWER, value: '**', raw: '**', pos: startPos };
        }
        // ?. optional chain
        if (two === '?.') {
            this.advance();
            this.advance();
            return { type: TokenType.OPTIONAL_CHAIN, value: '?.', raw: '?.', pos: startPos };
        }
        // ?? nullish coalescing
        if (two === '??') {
            this.advance();
            this.advance();
            return { type: TokenType.NULLISH_COAL, value: '??', raw: '??', pos: startPos };
        }
        // Single char
        this.advance();
        switch (ch) {
            case '+': return { type: TokenType.PLUS, value: '+', raw: '+', pos: startPos };
            case '-': return { type: TokenType.MINUS, value: '-', raw: '-', pos: startPos };
            case '*': return { type: TokenType.STAR, value: '*', raw: '*', pos: startPos };
            case '/': return { type: TokenType.SLASH, value: '/', raw: '/', pos: startPos };
            case '%': return { type: TokenType.PERCENT, value: '%', raw: '%', pos: startPos };
            case '=': return { type: TokenType.ASSIGN, value: '=', raw: '=', pos: startPos };
            case '<': return { type: TokenType.LT, value: '<', raw: '<', pos: startPos };
            case '>': return { type: TokenType.GT, value: '>', raw: '>', pos: startPos };
            case '!': return { type: TokenType.NOT, value: '!', raw: '!', pos: startPos };
            case '(': return { type: TokenType.LPAREN, value: '(', raw: '(', pos: startPos };
            case ')': return { type: TokenType.RPAREN, value: ')', raw: ')', pos: startPos };
            case '{': return { type: TokenType.LBRACE, value: '{', raw: '{', pos: startPos };
            case '}': return { type: TokenType.RBRACE, value: '}', raw: '}', pos: startPos };
            case '[': return { type: TokenType.LBRACKET, value: '[', raw: '[', pos: startPos };
            case ']': return { type: TokenType.RBRACKET, value: ']', raw: ']', pos: startPos };
            case ',': return { type: TokenType.COMMA, value: ',', raw: ',', pos: startPos };
            case '.': return { type: TokenType.DOT, value: '.', raw: '.', pos: startPos };
            case ':': return { type: TokenType.COLON, value: ':', raw: ':', pos: startPos };
            case ';': return { type: TokenType.SEMICOLON, value: ';', raw: ';', pos: startPos };
            case '?': return { type: TokenType.QUESTION, value: '?', raw: '?', pos: startPos };
            case '@': return { type: TokenType.AT, value: '@', raw: '@', pos: startPos };
            case '|': return { type: TokenType.PIPE, value: '|', raw: '|', pos: startPos };
            default:
                throw new LexerError(`Unexpected character: '${ch}' (U+${ch.charCodeAt(0).toString(16).padStart(4, '0')})`, startPos, this.filename);
        }
    }
    // ─── Character class helpers ──────────────────────────────────────────────
    isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }
    isAlpha(ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    }
    isAlphaNumeric(ch) {
        return this.isAlpha(ch) || this.isDigit(ch);
    }
}
exports.Lexer = Lexer;
// ─── Convenience function ─────────────────────────────────────────────────────
function tokenize(source, filename) {
    return new Lexer(source, filename).tokenize();
}
//# sourceMappingURL=index.js.map