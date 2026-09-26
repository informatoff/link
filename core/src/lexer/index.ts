/**
 * Link Language Lexer
 * Tokenizes .lk source files into a stream of typed tokens.
 * Supports all Link language constructs including:
 *   - Duration literals (500ms, 5s, 3d, etc.)
 *   - Custom operators: ~> (retry), |> (pipe)
 *   - String interpolation: "Hello, {name}!"
 *   - All keywords: link, listen, on, send, flow, hook, route, event, channel, etc.
 */

export enum TokenType {
  // ─── Literals ───────────────────────────────────────────────────────────────
  INTEGER     = 'INTEGER',
  FLOAT       = 'FLOAT',
  DURATION    = 'DURATION',   // 500ms, 5s, 3m, 2h, 1d
  STRING      = 'STRING',     // "hello"
  TEMPLATE    = 'TEMPLATE',   // "Hello, {name}!" (interpolated)
  BOOL        = 'BOOL',       // true / false
  NULL        = 'NULL',       // null

  // ─── Identifiers & Keywords ──────────────────────────────────────────────────
  IDENTIFIER  = 'IDENTIFIER',

  // Core keywords
  LET         = 'LET',
  CONST       = 'CONST',
  FLOW        = 'FLOW',
  FN          = 'FN',
  RETURN      = 'RETURN',
  IF          = 'IF',
  ELSE        = 'ELSE',
  ELIF        = 'ELIF',
  FOR         = 'FOR',
  IN          = 'IN',
  WHILE       = 'WHILE',
  LOOP        = 'LOOP',
  BREAK       = 'BREAK',
  CONTINUE    = 'CONTINUE',
  IMPORT      = 'IMPORT',
  EXPORT      = 'EXPORT',
  ASYNC       = 'ASYNC',
  AWAIT       = 'AWAIT',
  TRY         = 'TRY',
  CATCH       = 'CATCH',
  FINALLY     = 'FINALLY',
  THROW       = 'THROW',
  NEW         = 'NEW',
  STRUCT      = 'STRUCT',
  CLASS       = 'CLASS',
  THIS        = 'THIS',
  EXTENDS     = 'EXTENDS',
  NULL_KW     = 'NULL_KW',

  // Link-specific keywords
  LINK        = 'LINK',       // link keyword / lang name keyword
  LISTEN      = 'LISTEN',
  ON          = 'ON',
  SEND        = 'SEND',
  HOOK        = 'HOOK',
  ROUTE       = 'ROUTE',
  EMIT        = 'EMIT',
  EVENT       = 'EVENT',
  CHANNEL     = 'CHANNEL',
  REQUIRE     = 'REQUIRE',
  WAIT        = 'WAIT',
  RETRY       = 'RETRY',

  // ─── Operators ────────────────────────────────────────────────────────────────
  PLUS        = 'PLUS',           // +
  MINUS       = 'MINUS',          // -
  STAR        = 'STAR',           // *
  SLASH       = 'SLASH',          // /
  PERCENT     = 'PERCENT',        // %
  POWER       = 'POWER',          // **

  ASSIGN      = 'ASSIGN',         // =
  PLUS_ASSIGN = 'PLUS_ASSIGN',    // +=
  MINUS_ASSIGN= 'MINUS_ASSIGN',   // -=
  STAR_ASSIGN = 'STAR_ASSIGN',    // *=
  SLASH_ASSIGN= 'SLASH_ASSIGN',   // /=

  EQ          = 'EQ',             // ==
  NEQ         = 'NEQ',            // !=
  LT          = 'LT',             // <
  GT          = 'GT',             // >
  LTE         = 'LTE',            // <=
  GTE         = 'GTE',            // >=

  AND         = 'AND',            // &&
  OR          = 'OR',             // ||
  NOT         = 'NOT',            // !

  PIPE        = 'PIPE',           // |>  (pipe operator)
  RETRY_OP    = 'RETRY_OP',       // ~>  (retry operator)
  ARROW       = 'ARROW',          // =>  (lambda arrow)
  OPTIONAL_CHAIN = 'OPTIONAL_CHAIN', // ?.
  NULLISH_COAL   = 'NULLISH_COAL',   // ??

  // ─── Punctuation ─────────────────────────────────────────────────────────────
  LPAREN      = 'LPAREN',         // (
  RPAREN      = 'RPAREN',         // )
  LBRACE      = 'LBRACE',         // {
  RBRACE      = 'RBRACE',         // }
  LBRACKET    = 'LBRACKET',       // [
  RBRACKET    = 'RBRACKET',       // ]
  COMMA       = 'COMMA',          // ,
  DOT         = 'DOT',            // .
  COLON       = 'COLON',          // :
  SEMICOLON   = 'SEMICOLON',      // ;
  QUESTION    = 'QUESTION',       // ?
  AT          = 'AT',             // @

  // ─── Special ──────────────────────────────────────────────────────────────────
  NEWLINE     = 'NEWLINE',
  EOF         = 'EOF',
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  /** Raw source text of this token */
  raw: string;
  pos: Position;
}

// Duration unit types
export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w';

export interface DurationToken extends Token {
  type: TokenType.DURATION;
  amount: number;
  unit: DurationUnit;
}

// ─── Keyword map ────────────────────────────────────────────────────────────────
const KEYWORDS: Record<string, TokenType> = {
  let:      TokenType.LET,
  const:    TokenType.CONST,
  flow:     TokenType.FLOW,
  fn:       TokenType.FN,
  return:   TokenType.RETURN,
  if:       TokenType.IF,
  else:     TokenType.ELSE,
  elif:     TokenType.ELIF,
  for:      TokenType.FOR,
  in:       TokenType.IN,
  while:    TokenType.WHILE,
  loop:     TokenType.LOOP,
  break:    TokenType.BREAK,
  continue: TokenType.CONTINUE,
  import:   TokenType.IMPORT,
  export:   TokenType.EXPORT,
  async:    TokenType.ASYNC,
  await:    TokenType.AWAIT,
  try:      TokenType.TRY,
  catch:    TokenType.CATCH,
  finally:  TokenType.FINALLY,
  throw:    TokenType.THROW,
  new:      TokenType.NEW,
  struct:   TokenType.STRUCT,
  class:    TokenType.CLASS,
  this:     TokenType.THIS,
  extends:  TokenType.EXTENDS,
  null:     TokenType.NULL,
  true:     TokenType.BOOL,
  false:    TokenType.BOOL,

  // Link-specific
  link:     TokenType.LINK,
  listen:   TokenType.LISTEN,
  on:       TokenType.ON,
  send:     TokenType.SEND,
  hook:     TokenType.HOOK,
  route:    TokenType.ROUTE,
  emit:     TokenType.EMIT,
  event:    TokenType.EVENT,
  channel:  TokenType.CHANNEL,
  require:  TokenType.REQUIRE,
  wait:     TokenType.WAIT,
  retry:    TokenType.RETRY,
};

const DURATION_UNITS: Set<string> = new Set(['ms', 's', 'm', 'h', 'd', 'w']);

// ─── Lexer Error ──────────────────────────────────────────────────────────────

export class LexerError extends Error {
  constructor(
    message: string,
    public readonly pos: Position,
    public readonly source?: string,
  ) {
    super(message);
    this.name = 'LexerError';
  }
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

export class Lexer {
  private source: string;
  private filename: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string, filename = '<anonymous>') {
    this.source = source;
    this.filename = filename;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  tokenize(): Token[] {
    while (!this.isEOF()) {
      this.skipWhitespaceAndComments();
      if (this.isEOF()) break;

      const token = this.nextToken();
      if (token) this.tokens.push(token);
    }

    this.tokens.push(this.makeToken(TokenType.EOF, '', ''));
    return this.tokens;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private isEOF(offset = 0): boolean {
    return this.pos + offset >= this.source.length;
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? '\0';
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private match(expected: string): boolean {
    if (this.isEOF()) return false;
    if (this.source.startsWith(expected, this.pos)) {
      for (let i = 0; i < expected.length; i++) this.advance();
      return true;
    }
    return false;
  }

  private currentPos(): Position {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private makeToken(type: TokenType, value: string, raw: string, pos?: Position): Token {
    return {
      type,
      value,
      raw,
      pos: pos ?? this.currentPos(),
    };
  }

  // ─── Skip whitespace & comments ──────────────────────────────────────────────

  private skipWhitespaceAndComments(): void {
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
        while (!this.isEOF() && this.peek() !== '\n') this.advance();
        continue;
      }

      // Block comment: /* ... */
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); this.advance(); // consume /*
        while (!this.isEOF()) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance(); this.advance(); // consume */
            break;
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private shouldInsertNewline(type: TokenType): boolean {
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

  private nextToken(): Token | null {
    const startPos = this.currentPos();
    const ch = this.peek();

    // Numbers
    if (this.isDigit(ch)) return this.readNumber(startPos);

    // Strings
    if (ch === '"' || ch === "'") return this.readString(startPos);

    // Identifiers & keywords
    if (this.isAlpha(ch) || ch === '_') return this.readIdentifier(startPos);

    // Operators & punctuation
    return this.readOperatorOrPunct(startPos);
  }

  // ─── Number / Duration reader ─────────────────────────────────────────────

  private readNumber(startPos: Position): Token {
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
        const token: DurationToken = {
          type: TokenType.DURATION,
          value: fullRaw,
          raw: fullRaw,
          pos: startPos,
          amount: parseFloat(raw),
          unit: suffix as DurationUnit,
        };
        return token;
      }

      // Not a duration — put suffix back by rewinding
      // We can't truly rewind, so we need to lex it as error or part of identifier
      // Instead, we'll treat the full thing as a malformed token
      const badRaw = raw + suffix;
      throw new LexerError(
        `Invalid number literal: '${badRaw}'`,
        startPos,
        this.filename,
      );
    }

    if (isFloat) {
      return { type: TokenType.FLOAT, value: raw, raw, pos: startPos };
    }
    return { type: TokenType.INTEGER, value: raw, raw, pos: startPos };
  }

  // ─── String reader (with interpolation detection) ─────────────────────────

  private readString(startPos: Position): Token {
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
            case 'n':  value += '\n'; break;
            case 't':  value += '\t'; break;
            case 'r':  value += '\r'; break;
            case '"':  value += '"'; break;
            case "'":  value += "'"; break;
            case '\\': value += '\\'; break;
            case '{':  value += '{'; break;
            default:   value += '\\' + escaped;
          }
        }
      } else if (this.peek() === '{' && quote === '"') {
        // String interpolation: {expression}
        hasInterpolation = true;
        raw += this.advance(); // consume '{'
        value += '{';
        let depth = 1;
        while (!this.isEOF() && depth > 0) {
          const c = this.peek();
          if (c === '{') depth++;
          if (c === '}') depth--;
          if (depth > 0 || c !== '}') {
            raw += c;
            value += c;
          }
          if (depth === 0) {
            raw += this.advance(); // consume closing '}'
            value += '}';
          } else {
            this.advance();
          }
        }
      } else if (this.peek() === '\n') {
        throw new LexerError('Unterminated string literal', startPos, this.filename);
      } else {
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

  private readIdentifier(startPos: Position): Token {
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

  private readOperatorOrPunct(startPos: Position): Token {
    const ch = this.peek();

    // Two-char operators first
    const two = this.source.slice(this.pos, this.pos + 2);

    // ~> retry operator
    if (two === '~>') {
      this.advance(); this.advance();
      return { type: TokenType.RETRY_OP, value: '~>', raw: '~>', pos: startPos };
    }

    // |> pipe operator
    if (two === '|>') {
      this.advance(); this.advance();
      return { type: TokenType.PIPE, value: '|>', raw: '|>', pos: startPos };
    }

    // => arrow
    if (two === '=>') {
      this.advance(); this.advance();
      return { type: TokenType.ARROW, value: '=>', raw: '=>', pos: startPos };
    }

    // == equality
    if (two === '==') {
      this.advance(); this.advance();
      return { type: TokenType.EQ, value: '==', raw: '==', pos: startPos };
    }

    // != not-equal
    if (two === '!=') {
      this.advance(); this.advance();
      return { type: TokenType.NEQ, value: '!=', raw: '!=', pos: startPos };
    }

    // <= lte
    if (two === '<=') {
      this.advance(); this.advance();
      return { type: TokenType.LTE, value: '<=', raw: '<=', pos: startPos };
    }

    // >= gte
    if (two === '>=') {
      this.advance(); this.advance();
      return { type: TokenType.GTE, value: '>=', raw: '>=', pos: startPos };
    }

    // && and
    if (two === '&&') {
      this.advance(); this.advance();
      return { type: TokenType.AND, value: '&&', raw: '&&', pos: startPos };
    }

    // || or
    if (two === '||') {
      this.advance(); this.advance();
      return { type: TokenType.OR, value: '||', raw: '||', pos: startPos };
    }

    // += plus assign
    if (two === '+=') {
      this.advance(); this.advance();
      return { type: TokenType.PLUS_ASSIGN, value: '+=', raw: '+=', pos: startPos };
    }

    // -= minus assign
    if (two === '-=') {
      this.advance(); this.advance();
      return { type: TokenType.MINUS_ASSIGN, value: '-=', raw: '-=', pos: startPos };
    }

    // *= star assign
    if (two === '*=') {
      this.advance(); this.advance();
      return { type: TokenType.STAR_ASSIGN, value: '*=', raw: '*=', pos: startPos };
    }

    // /= slash assign
    if (two === '/=') {
      this.advance(); this.advance();
      return { type: TokenType.SLASH_ASSIGN, value: '/=', raw: '/=', pos: startPos };
    }

    // ** power
    if (two === '**') {
      this.advance(); this.advance();
      return { type: TokenType.POWER, value: '**', raw: '**', pos: startPos };
    }

    // ?. optional chain
    if (two === '?.') {
      this.advance(); this.advance();
      return { type: TokenType.OPTIONAL_CHAIN, value: '?.', raw: '?.', pos: startPos };
    }

    // ?? nullish coalescing
    if (two === '??') {
      this.advance(); this.advance();
      return { type: TokenType.NULLISH_COAL, value: '??', raw: '??', pos: startPos };
    }

    // Single char
    this.advance();
    switch (ch) {
      case '+': return { type: TokenType.PLUS,     value: '+', raw: '+', pos: startPos };
      case '-': return { type: TokenType.MINUS,    value: '-', raw: '-', pos: startPos };
      case '*': return { type: TokenType.STAR,     value: '*', raw: '*', pos: startPos };
      case '/': return { type: TokenType.SLASH,    value: '/', raw: '/', pos: startPos };
      case '%': return { type: TokenType.PERCENT,  value: '%', raw: '%', pos: startPos };
      case '=': return { type: TokenType.ASSIGN,   value: '=', raw: '=', pos: startPos };
      case '<': return { type: TokenType.LT,       value: '<', raw: '<', pos: startPos };
      case '>': return { type: TokenType.GT,       value: '>', raw: '>', pos: startPos };
      case '!': return { type: TokenType.NOT,      value: '!', raw: '!', pos: startPos };
      case '(': return { type: TokenType.LPAREN,   value: '(', raw: '(', pos: startPos };
      case ')': return { type: TokenType.RPAREN,   value: ')', raw: ')', pos: startPos };
      case '{': return { type: TokenType.LBRACE,   value: '{', raw: '{', pos: startPos };
      case '}': return { type: TokenType.RBRACE,   value: '}', raw: '}', pos: startPos };
      case '[': return { type: TokenType.LBRACKET, value: '[', raw: '[', pos: startPos };
      case ']': return { type: TokenType.RBRACKET, value: ']', raw: ']', pos: startPos };
      case ',': return { type: TokenType.COMMA,    value: ',', raw: ',', pos: startPos };
      case '.': return { type: TokenType.DOT,      value: '.', raw: '.', pos: startPos };
      case ':': return { type: TokenType.COLON,    value: ':', raw: ':', pos: startPos };
      case ';': return { type: TokenType.SEMICOLON,value: ';', raw: ';', pos: startPos };
      case '?': return { type: TokenType.QUESTION, value: '?', raw: '?', pos: startPos };
      case '@': return { type: TokenType.AT,       value: '@', raw: '@', pos: startPos };
      case '|': return { type: TokenType.PIPE,     value: '|', raw: '|', pos: startPos };
      default:
        throw new LexerError(
          `Unexpected character: '${ch}' (U+${ch.charCodeAt(0).toString(16).padStart(4, '0')})`,
          startPos,
          this.filename,
        );
    }
  }

  // ─── Character class helpers ──────────────────────────────────────────────

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
}

// ─── Convenience function ─────────────────────────────────────────────────────

export function tokenize(source: string, filename?: string): Token[] {
  return new Lexer(source, filename).tokenize();
}
