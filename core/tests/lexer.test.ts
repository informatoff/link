import { describe, it, expect } from 'vitest';
import { Lexer, TokenType, tokenize, LexerError, type Token, type DurationToken } from '../src/lexer/index.js';

// ─── Helper ────────────────────────────────────────────────────────────────────

function types(src: string): TokenType[] {
  return tokenize(src)
    .filter(t => t.type !== TokenType.EOF && t.type !== TokenType.NEWLINE)
    .map(t => t.type);
}

function vals(src: string): string[] {
  return tokenize(src)
    .filter(t => t.type !== TokenType.EOF && t.type !== TokenType.NEWLINE)
    .map(t => t.value);
}

// ─── Literals ─────────────────────────────────────────────────────────────────

describe('Integer literals', () => {
  it('tokenizes a simple integer', () => {
    const tokens = tokenize('42');
    expect(tokens[0].type).toBe(TokenType.INTEGER);
    expect(tokens[0].value).toBe('42');
  });

  it('tokenizes zero', () => {
    expect(types('0')).toEqual([TokenType.INTEGER]);
  });

  it('tokenizes multiple integers', () => {
    expect(types('1 2 3')).toEqual([TokenType.INTEGER, TokenType.INTEGER, TokenType.INTEGER]);
  });
});

describe('Float literals', () => {
  it('tokenizes a float', () => {
    const tokens = tokenize('3.14');
    expect(tokens[0].type).toBe(TokenType.FLOAT);
    expect(tokens[0].value).toBe('3.14');
  });

  it('tokenizes 0.5', () => {
    expect(types('0.5')).toEqual([TokenType.FLOAT]);
  });
});

describe('Duration literals', () => {
  it('tokenizes 500ms', () => {
    const tokens = tokenize('500ms');
    expect(tokens[0].type).toBe(TokenType.DURATION);
    const dur = tokens[0] as DurationToken;
    expect(dur.amount).toBe(500);
    expect(dur.unit).toBe('ms');
  });

  it('tokenizes 5s', () => {
    const dur = tokenize('5s')[0] as DurationToken;
    expect(dur.type).toBe(TokenType.DURATION);
    expect(dur.amount).toBe(5);
    expect(dur.unit).toBe('s');
  });

  it('tokenizes 3m', () => {
    const dur = tokenize('3m')[0] as DurationToken;
    expect(dur.amount).toBe(3);
    expect(dur.unit).toBe('m');
  });

  it('tokenizes 2h', () => {
    const dur = tokenize('2h')[0] as DurationToken;
    expect(dur.amount).toBe(2);
    expect(dur.unit).toBe('h');
  });

  it('tokenizes 1d', () => {
    const dur = tokenize('1d')[0] as DurationToken;
    expect(dur.amount).toBe(1);
    expect(dur.unit).toBe('d');
  });

  it('tokenizes 1w (week)', () => {
    const dur = tokenize('1w')[0] as DurationToken;
    expect(dur.amount).toBe(1);
    expect(dur.unit).toBe('w');
  });

  it('tokenizes 500ms in context', () => {
    const tokens = tokenize('wait 500ms');
    const filtered = tokens.filter(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
    expect(filtered[0].type).toBe(TokenType.WAIT);
    expect(filtered[1].type).toBe(TokenType.DURATION);
  });
});

describe('Boolean literals', () => {
  it('tokenizes true', () => {
    const t = tokenize('true')[0];
    expect(t.type).toBe(TokenType.BOOL);
    expect(t.value).toBe('true');
  });

  it('tokenizes false', () => {
    const t = tokenize('false')[0];
    expect(t.type).toBe(TokenType.BOOL);
    expect(t.value).toBe('false');
  });
});

describe('Null literal', () => {
  it('tokenizes null', () => {
    expect(types('null')).toEqual([TokenType.NULL]);
  });
});

describe('String literals', () => {
  it('tokenizes a simple string', () => {
    const t = tokenize('"hello"')[0];
    expect(t.type).toBe(TokenType.STRING);
    expect(t.value).toBe('hello');
  });

  it('tokenizes an empty string', () => {
    expect(tokenize('""')[0].value).toBe('');
  });

  it('tokenizes escape sequences', () => {
    const t = tokenize('"hello\\nworld"')[0];
    expect(t.value).toBe('hello\nworld');
  });

  it('tokenizes single-quoted string', () => {
    const t = tokenize("'hello'")[0];
    expect(t.type).toBe(TokenType.STRING);
    expect(t.value).toBe('hello');
  });
});

describe('Template (interpolated) strings', () => {
  it('detects interpolation in double-quoted strings', () => {
    const t = tokenize('"Hello, {name}!"')[0];
    expect(t.type).toBe(TokenType.TEMPLATE);
    expect(t.value).toBe('Hello, {name}!');
  });

  it('leaves single-quoted strings as STRING even with braces', () => {
    const t = tokenize("'Hello, {name}!'")[0];
    expect(t.type).toBe(TokenType.STRING);
  });

  it('tokenizes nested braces in interpolation', () => {
    const t = tokenize('"Value: {obj.method()}"')[0];
    expect(t.type).toBe(TokenType.TEMPLATE);
  });
});

// ─── Keywords ────────────────────────────────────────────────────────────────

describe('Link-specific keywords', () => {
  const keywords: [string, TokenType][] = [
    ['link',    TokenType.LINK],
    ['listen',  TokenType.LISTEN],
    ['on',      TokenType.ON],
    ['send',    TokenType.SEND],
    ['hook',    TokenType.HOOK],
    ['route',   TokenType.ROUTE],
    ['emit',    TokenType.EMIT],
    ['event',   TokenType.EVENT],
    ['channel', TokenType.CHANNEL],
    ['require', TokenType.REQUIRE],
    ['wait',    TokenType.WAIT],
    ['retry',   TokenType.RETRY],
    ['flow',    TokenType.FLOW],
  ];

  for (const [kw, expected] of keywords) {
    it(`tokenizes '${kw}'`, () => {
      expect(types(kw)).toEqual([expected]);
    });
  }
});

describe('General keywords', () => {
  const keywords: [string, TokenType][] = [
    ['let',      TokenType.LET],
    ['const',    TokenType.CONST],
    ['fn',       TokenType.FN],
    ['return',   TokenType.RETURN],
    ['if',       TokenType.IF],
    ['else',     TokenType.ELSE],
    ['elif',     TokenType.ELIF],
    ['for',      TokenType.FOR],
    ['in',       TokenType.IN],
    ['while',    TokenType.WHILE],
    ['loop',     TokenType.LOOP],
    ['break',    TokenType.BREAK],
    ['continue', TokenType.CONTINUE],
    ['import',   TokenType.IMPORT],
    ['export',   TokenType.EXPORT],
    ['async',    TokenType.ASYNC],
    ['await',    TokenType.AWAIT],
    ['try',      TokenType.TRY],
    ['catch',    TokenType.CATCH],
    ['finally',  TokenType.FINALLY],
    ['struct',   TokenType.STRUCT],
    ['class',    TokenType.CLASS],
  ];

  for (const [kw, expected] of keywords) {
    it(`tokenizes '${kw}'`, () => {
      expect(types(kw)).toEqual([expected]);
    });
  }
});

// ─── Operators ────────────────────────────────────────────────────────────────

describe('Custom operators', () => {
  it('tokenizes ~> (retry operator)', () => {
    expect(types('~>')).toEqual([TokenType.RETRY_OP]);
  });

  it('tokenizes |> (pipe operator)', () => {
    expect(types('|>')).toEqual([TokenType.PIPE]);
  });

  it('tokenizes => (arrow)', () => {
    expect(types('=>')).toEqual([TokenType.ARROW]);
  });

  it('tokenizes ~> in context: result = fetch(url) ~> retry(3)', () => {
    const t = types('result = fetch(url) ~> retry(3)');
    expect(t).toContain(TokenType.RETRY_OP);
  });

  it('tokenizes |> in pipeline: msg |> trim |> send', () => {
    const t = types('msg |> trim |> send');
    expect(t.filter(x => x === TokenType.PIPE)).toHaveLength(2);
  });
});

describe('Arithmetic operators', () => {
  it('tokenizes + - * / % **', () => {
    expect(types('+ - * / % **')).toEqual([
      TokenType.PLUS, TokenType.MINUS, TokenType.STAR,
      TokenType.SLASH, TokenType.PERCENT, TokenType.POWER,
    ]);
  });
});

describe('Comparison operators', () => {
  it('tokenizes == != < > <= >=', () => {
    expect(types('== != < > <= >=')).toEqual([
      TokenType.EQ, TokenType.NEQ, TokenType.LT,
      TokenType.GT, TokenType.LTE, TokenType.GTE,
    ]);
  });
});

describe('Logical operators', () => {
  it('tokenizes && ||', () => {
    expect(types('&& ||')).toEqual([TokenType.AND, TokenType.OR]);
  });

  it('tokenizes !', () => {
    expect(types('!')).toEqual([TokenType.NOT]);
  });
});

describe('Assignment operators', () => {
  it('tokenizes = += -= *= /=', () => {
    expect(types('= += -= *= /=')).toEqual([
      TokenType.ASSIGN,
      TokenType.PLUS_ASSIGN,
      TokenType.MINUS_ASSIGN,
      TokenType.STAR_ASSIGN,
      TokenType.SLASH_ASSIGN,
    ]);
  });
});

describe('Optional chain and nullish', () => {
  it('tokenizes ?.', () => {
    expect(types('?.')).toEqual([TokenType.OPTIONAL_CHAIN]);
  });

  it('tokenizes ??', () => {
    expect(types('??')).toEqual([TokenType.NULLISH_COAL]);
  });
});

// ─── Punctuation ──────────────────────────────────────────────────────────────

describe('Punctuation', () => {
  it('tokenizes () {} [] , . : ;', () => {
    expect(types('() {} [] , . : ;')).toEqual([
      TokenType.LPAREN, TokenType.RPAREN,
      TokenType.LBRACE, TokenType.RBRACE,
      TokenType.LBRACKET, TokenType.RBRACKET,
      TokenType.COMMA, TokenType.DOT, TokenType.COLON, TokenType.SEMICOLON,
    ]);
  });
});

// ─── Comments ────────────────────────────────────────────────────────────────

describe('Comments', () => {
  it('skips line comments', () => {
    expect(types('// this is a comment\n42')).toEqual([TokenType.INTEGER]);
  });

  it('skips block comments', () => {
    expect(types('/* block */ 42')).toEqual([TokenType.INTEGER]);
  });

  it('skips multiline block comments', () => {
    const src = `/*
      Multi
      line
    */
    99`;
    expect(types(src)).toEqual([TokenType.INTEGER]);
  });
});

// ─── Position tracking ────────────────────────────────────────────────────────

describe('Position tracking', () => {
  it('tracks line and column for first token', () => {
    const t = tokenize('hello')[0];
    expect(t.pos.line).toBe(1);
    expect(t.pos.column).toBe(1);
  });

  it('tracks column offset correctly', () => {
    const tokens = tokenize('let x = 42');
    const filtered = tokens.filter(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
    expect(filtered[0].pos.column).toBe(1); // let
    expect(filtered[1].pos.column).toBe(5); // x
    expect(filtered[2].pos.column).toBe(7); // =
    expect(filtered[3].pos.column).toBe(9); // 42
  });

  it('tracks line numbers after newlines', () => {
    const src = 'let x = 1\nlet y = 2';
    const tokens = tokenize(src).filter(t => t.type === TokenType.LET);
    expect(tokens[0].pos.line).toBe(1);
    expect(tokens[1].pos.line).toBe(2);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('throws LexerError on unexpected character', () => {
    expect(() => tokenize('$invalid')).toThrow(LexerError);
  });

  it('throws LexerError on unterminated string', () => {
    expect(() => tokenize('"hello')).toThrow(LexerError);
  });

  it('includes position in error', () => {
    try {
      tokenize('  $bad');
    } catch (e) {
      expect(e).toBeInstanceOf(LexerError);
      expect((e as LexerError).pos.column).toBe(3);
    }
  });
});

// ─── Full program tokenization ────────────────────────────────────────────────

describe('Full Link program tokenization', () => {
  it('tokenizes a complete bot snippet', () => {
    const src = `
// Simple bot
channel bot = link telegram("TOKEN")

listen bot {
    on message(msg) {
        flow user = db.get(msg.user_id)
        user.messages += 1
        send(msg.chat, "Hello, {msg.author}!")
    }
}

hook on_start {
    log.info("Bot started!")
}
`;
    const tokens = tokenize(src);
    expect(tokens.some(t => t.type === TokenType.CHANNEL)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.LISTEN)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.ON)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.FLOW)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.HOOK)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.SEND)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.TEMPLATE)).toBe(true);
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('tokenizes retry operator in network call', () => {
    const src = 'result = api.fetch(url) ~> retry(3, delay: 500ms)';
    const tokens = tokenize(src).filter(t => t.type !== TokenType.EOF);
    expect(tokens.some(t => t.type === TokenType.RETRY_OP)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.DURATION)).toBe(true);
  });

  it('tokenizes pipe chain', () => {
    const src = 'msg.text |> trim |> lowercase |> send';
    const tokens = tokenize(src).filter(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
    const pipes = tokens.filter(t => t.type === TokenType.PIPE);
    expect(pipes).toHaveLength(3);
  });

  it('tokenizes route with optional param', () => {
    // Route patterns with {param} are classified as TEMPLATE (they contain interpolation syntax)
    // The parser will distinguish them from regular interpolated strings by context
    const src = 'route "/ban {user} {reason?}" { }';
    const tokens = tokenize(src).filter(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
    expect(tokens[0].type).toBe(TokenType.ROUTE);
    // "/ban {user} {reason?}" has {} so it's a TEMPLATE token — correct behavior
    expect(tokens[1].type).toBe(TokenType.TEMPLATE);
  });
});

// ─── Identifier edge cases ───────────────────────────────────────────────────

describe('Identifiers', () => {
  it('tokenizes snake_case', () => {
    expect(types('my_variable')).toEqual([TokenType.IDENTIFIER]);
    expect(vals('my_variable')).toEqual(['my_variable']);
  });

  it('tokenizes camelCase', () => {
    expect(types('myVariable')).toEqual([TokenType.IDENTIFIER]);
  });

  it('tokenizes identifier starting with underscore', () => {
    expect(types('_private')).toEqual([TokenType.IDENTIFIER]);
  });

  it('distinguishes identifier from keyword', () => {
    expect(types('linked')).toEqual([TokenType.IDENTIFIER]);
    expect(types('link')).toEqual([TokenType.LINK]);
  });

  it('distinguishes "flowState" from "flow" keyword', () => {
    expect(types('flowState')).toEqual([TokenType.IDENTIFIER]);
    expect(types('flow')).toEqual([TokenType.FLOW]);
  });
});
