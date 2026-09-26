/**
 * Link Language Lexer
 * Tokenizes .lk source files into a stream of typed tokens.
 * Supports all Link language constructs including:
 *   - Duration literals (500ms, 5s, 3d, etc.)
 *   - Custom operators: ~> (retry), |> (pipe)
 *   - String interpolation: "Hello, {name}!"
 *   - All keywords: link, listen, on, send, flow, hook, route, event, channel, etc.
 */
export declare enum TokenType {
    INTEGER = "INTEGER",
    FLOAT = "FLOAT",
    DURATION = "DURATION",// 500ms, 5s, 3m, 2h, 1d
    STRING = "STRING",// "hello"
    TEMPLATE = "TEMPLATE",// "Hello, {name}!" (interpolated)
    BOOL = "BOOL",// true / false
    NULL = "NULL",// null
    IDENTIFIER = "IDENTIFIER",
    LET = "LET",
    CONST = "CONST",
    FLOW = "FLOW",
    FN = "FN",
    RETURN = "RETURN",
    IF = "IF",
    ELSE = "ELSE",
    ELIF = "ELIF",
    FOR = "FOR",
    IN = "IN",
    WHILE = "WHILE",
    LOOP = "LOOP",
    BREAK = "BREAK",
    CONTINUE = "CONTINUE",
    IMPORT = "IMPORT",
    EXPORT = "EXPORT",
    ASYNC = "ASYNC",
    AWAIT = "AWAIT",
    TRY = "TRY",
    CATCH = "CATCH",
    FINALLY = "FINALLY",
    THROW = "THROW",
    NEW = "NEW",
    STRUCT = "STRUCT",
    CLASS = "CLASS",
    THIS = "THIS",
    EXTENDS = "EXTENDS",
    NULL_KW = "NULL_KW",
    LINK = "LINK",// link keyword / lang name keyword
    LISTEN = "LISTEN",
    ON = "ON",
    SEND = "SEND",
    HOOK = "HOOK",
    ROUTE = "ROUTE",
    EMIT = "EMIT",
    EVENT = "EVENT",
    CHANNEL = "CHANNEL",
    REQUIRE = "REQUIRE",
    WAIT = "WAIT",
    RETRY = "RETRY",
    PLUS = "PLUS",// +
    MINUS = "MINUS",// -
    STAR = "STAR",// *
    SLASH = "SLASH",// /
    PERCENT = "PERCENT",// %
    POWER = "POWER",// **
    ASSIGN = "ASSIGN",// =
    PLUS_ASSIGN = "PLUS_ASSIGN",// +=
    MINUS_ASSIGN = "MINUS_ASSIGN",// -=
    STAR_ASSIGN = "STAR_ASSIGN",// *=
    SLASH_ASSIGN = "SLASH_ASSIGN",// /=
    EQ = "EQ",// ==
    NEQ = "NEQ",// !=
    LT = "LT",// <
    GT = "GT",// >
    LTE = "LTE",// <=
    GTE = "GTE",// >=
    AND = "AND",// &&
    OR = "OR",// ||
    NOT = "NOT",// !
    PIPE = "PIPE",// |>  (pipe operator)
    RETRY_OP = "RETRY_OP",// ~>  (retry operator)
    ARROW = "ARROW",// =>  (lambda arrow)
    OPTIONAL_CHAIN = "OPTIONAL_CHAIN",// ?.
    NULLISH_COAL = "NULLISH_COAL",// ??
    LPAREN = "LPAREN",// (
    RPAREN = "RPAREN",// )
    LBRACE = "LBRACE",// {
    RBRACE = "RBRACE",// }
    LBRACKET = "LBRACKET",// [
    RBRACKET = "RBRACKET",// ]
    COMMA = "COMMA",// ,
    DOT = "DOT",// .
    COLON = "COLON",// :
    SEMICOLON = "SEMICOLON",// ;
    QUESTION = "QUESTION",// ?
    AT = "AT",// @
    NEWLINE = "NEWLINE",
    EOF = "EOF"
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
export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w';
export interface DurationToken extends Token {
    type: TokenType.DURATION;
    amount: number;
    unit: DurationUnit;
}
export declare class LexerError extends Error {
    readonly pos: Position;
    readonly source?: string | undefined;
    constructor(message: string, pos: Position, source?: string | undefined);
}
export declare class Lexer {
    private source;
    private filename;
    private pos;
    private line;
    private column;
    private tokens;
    constructor(source: string, filename?: string);
    tokenize(): Token[];
    private isEOF;
    private peek;
    private advance;
    private match;
    private currentPos;
    private makeToken;
    private skipWhitespaceAndComments;
    private shouldInsertNewline;
    private nextToken;
    private readNumber;
    private readString;
    private readIdentifier;
    private readOperatorOrPunct;
    private isDigit;
    private isAlpha;
    private isAlphaNumeric;
}
export declare function tokenize(source: string, filename?: string): Token[];
//# sourceMappingURL=index.d.ts.map