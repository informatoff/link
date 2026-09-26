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
import { type Token } from '../lexer/index.js';
import type { Program } from '../ast/index.js';
import type { Position } from '../lexer/index.js';
export declare class ParseError extends Error {
    readonly pos: Position;
    readonly filename: string;
    readonly src?: string | undefined;
    constructor(message: string, pos: Position, filename?: string, src?: string | undefined);
}
export declare class Parser {
    private tokens;
    private pos;
    private filename;
    private src;
    constructor(tokens: Token[], src?: string, filename?: string);
    private peek;
    private advance;
    private check;
    private currentType;
    private match;
    private expect;
    private skipNewlines;
    private currentPos;
    private error;
    /**
     * Lookahead: { IDENTIFIER : ... } or { STRING : ... } → dict literal
     * Otherwise → block
     */
    private looksLikeDict;
    parse(): Program;
    private parseStatement;
    private parseImport;
    private parseExport;
    private parseVarDecl;
    private parseFnDecl;
    private parseStructDecl;
    private parseClassDecl;
    private parseEventDecl;
    private parseChannelDecl;
    private parseListenStmt;
    private parseOnStmt;
    private parseRouteStmt;
    private extractRouteParams;
    private parseRequireClause;
    private parseHookStmt;
    private parseEmitStmt;
    private parseWaitStmt;
    private parseIfStmt;
    private parseForStmt;
    private parseWhileStmt;
    private parseLoopStmt;
    private parseTryStmt;
    private parseReturnStmt;
    private parseBreakStmt;
    private parseContinueStmt;
    private parseThrowStmt;
    private parseExprStmt;
    private parseBlock;
    private parseParamList;
    private parseParam;
    private parseArgList;
    private parseArg;
    private parseExpression;
    private parsePrec;
    private getBinaryOp;
    private getPrec;
    private parseUnary;
    private parseCall;
    private parsePrimary;
    private parseTemplate;
    private parseArrayLiteral;
    private parseDictLiteral;
    private parseParenOrLambda;
    private isLambdaAhead;
    private parseParenLambda;
    private parseSingleParamLambda;
    private parseFnLiteralAsLambda;
    private parseNewExpr;
    private consumeStatementEnd;
}
export declare function durationToMs(amount: number, unit: string): number;
export declare function parse(src: string, filename?: string): Program;
//# sourceMappingURL=index.d.ts.map