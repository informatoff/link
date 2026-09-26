import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../src/parser/index.js';
import type {
  Program, VarDecl, FnDecl, IfStmt, ForStmt, WhileStmt, LoopStmt,
  BinaryExpr, UnaryExpr, AssignExpr, CallExpr, MemberExpr, IndexExpr,
  PipeExpr, RetryExpr, AwaitExpr, TernaryExpr, LambdaExpr, ArrayLiteral,
  DictLiteral, TemplateLiteral, DurationLiteral, IntegerLiteral, FloatLiteral,
  BoolLiteral, StringLiteral, NullLiteral, Identifier, ExprStmt,
  EventDecl, ChannelDecl, ListenStmt, OnStmt, RouteStmt, HookStmt,
  EmitStmt, WaitStmt, TryStmt, ReturnStmt, ImportDecl, StructDecl,
  Block,
} from '../src/ast/index.js';

// ─── Helper ────────────────────────────────────────────────────────────────────

function parseExpr(src: string) {
  const prog = parse(src);
  const stmt = prog.body[0];
  if (stmt.kind !== 'ExprStmt') throw new Error(`Expected ExprStmt, got ${stmt.kind}`);
  return stmt.expr;
}

function firstStmt(src: string) {
  return parse(src).body[0];
}

// ─── Literals ─────────────────────────────────────────────────────────────────

describe('Integer literals', () => {
  it('parses 42', () => {
    const e = parseExpr('42') as IntegerLiteral;
    expect(e.kind).toBe('IntegerLiteral');
    expect(e.value).toBe(42);
  });

  it('parses 0', () => {
    const e = parseExpr('0') as IntegerLiteral;
    expect(e.value).toBe(0);
  });
});

describe('Float literals', () => {
  it('parses 3.14', () => {
    const e = parseExpr('3.14') as FloatLiteral;
    expect(e.kind).toBe('FloatLiteral');
    expect(e.value).toBeCloseTo(3.14);
  });
});

describe('Duration literals', () => {
  it('parses 500ms', () => {
    const e = parseExpr('500ms') as DurationLiteral;
    expect(e.kind).toBe('DurationLiteral');
    expect(e.amount).toBe(500);
    expect(e.unit).toBe('ms');
    expect(e.ms).toBe(500);
  });

  it('parses 5s and converts to ms', () => {
    const e = parseExpr('5s') as DurationLiteral;
    expect(e.ms).toBe(5000);
  });

  it('parses 2h', () => {
    const e = parseExpr('2h') as DurationLiteral;
    expect(e.ms).toBe(7_200_000);
  });

  it('parses 1d', () => {
    const e = parseExpr('1d') as DurationLiteral;
    expect(e.ms).toBe(86_400_000);
  });
});

describe('Boolean and null', () => {
  it('parses true', () => {
    const e = parseExpr('true') as BoolLiteral;
    expect(e.kind).toBe('BoolLiteral');
    expect(e.value).toBe(true);
  });

  it('parses false', () => {
    const e = parseExpr('false') as BoolLiteral;
    expect(e.value).toBe(false);
  });

  it('parses null', () => {
    const e = parseExpr('null') as NullLiteral;
    expect(e.kind).toBe('NullLiteral');
  });
});

describe('String literals', () => {
  it('parses simple string', () => {
    const e = parseExpr('"hello"') as StringLiteral;
    expect(e.kind).toBe('StringLiteral');
    expect(e.value).toBe('hello');
  });
});

describe('Template literals', () => {
  it('parses "Hello, {name}!"', () => {
    const e = parseExpr('"Hello, {name}!"') as TemplateLiteral;
    expect(e.kind).toBe('TemplateLiteral');
    expect(e.parts).toHaveLength(3); // "Hello, " | name | "!"
    expect(e.parts[0]).toEqual({ type: 'text', text: 'Hello, ' });
    expect(e.parts[1].type).toBe('expr');
    expect(e.parts[2]).toEqual({ type: 'text', text: '!' });
  });

  it('parses "{a} + {b}"', () => {
    const e = parseExpr('"{a} + {b}"') as TemplateLiteral;
    const exprParts = e.parts.filter(p => p.type === 'expr');
    expect(exprParts).toHaveLength(2);
  });
});

describe('Array literals', () => {
  it('parses empty array', () => {
    const e = parseExpr('[]') as ArrayLiteral;
    expect(e.kind).toBe('ArrayLiteral');
    expect(e.elements).toHaveLength(0);
  });

  it('parses [1, 2, 3]', () => {
    const e = parseExpr('[1, 2, 3]') as ArrayLiteral;
    expect(e.elements).toHaveLength(3);
    expect((e.elements[0] as IntegerLiteral).value).toBe(1);
  });

  it('parses nested array', () => {
    const e = parseExpr('[[1, 2], [3]]') as ArrayLiteral;
    expect(e.elements).toHaveLength(2);
    expect((e.elements[0] as ArrayLiteral).kind).toBe('ArrayLiteral');
  });
});

describe('Dict literals', () => {
  it('parses dict as variable initializer: let d = {}', () => {
    // {} in statement position is a Block; as expression (after =) it's a dict
    const s = firstStmt('let d = {}') as VarDecl;
    expect(s.kind).toBe('VarDecl');
    expect(s.init?.kind).toBe('DictLiteral');
    expect((s.init as DictLiteral).entries).toHaveLength(0);
  });

  it('parses {key: value} as expression statement (dict)', () => {
    const e = parseExpr('{host: "localhost", port: 8080}') as DictLiteral;
    expect(e.entries).toHaveLength(2);
    expect(e.entries[0].key).toBe('host');
    expect((e.entries[1].value as IntegerLiteral).value).toBe(8080);
  });
});

// ─── Expressions ──────────────────────────────────────────────────────────────

describe('Binary expressions', () => {
  it('parses 1 + 2', () => {
    const e = parseExpr('1 + 2') as BinaryExpr;
    expect(e.kind).toBe('BinaryExpr');
    expect(e.op).toBe('+');
    expect((e.left as IntegerLiteral).value).toBe(1);
    expect((e.right as IntegerLiteral).value).toBe(2);
  });

  it('respects operator precedence: 1 + 2 * 3', () => {
    const e = parseExpr('1 + 2 * 3') as BinaryExpr;
    expect(e.op).toBe('+');
    expect((e.right as BinaryExpr).op).toBe('*');
  });

  it('parses comparison: a == b', () => {
    const e = parseExpr('a == b') as BinaryExpr;
    expect(e.op).toBe('==');
  });

  it('parses logical: a && b || c', () => {
    // || has lower precedence than &&, so: (a && b) || c
    const e = parseExpr('a && b || c') as BinaryExpr;
    expect(e.op).toBe('||');
    expect((e.left as BinaryExpr).op).toBe('&&');
  });

  it('parses power: 2 ** 10', () => {
    const e = parseExpr('2 ** 10') as BinaryExpr;
    expect(e.op).toBe('**');
  });

  it('parses nullish coalescing: a ?? b', () => {
    const e = parseExpr('a ?? b') as BinaryExpr;
    expect(e.op).toBe('??');
  });
});

describe('Unary expressions', () => {
  it('parses !flag', () => {
    const e = parseExpr('!flag') as UnaryExpr;
    expect(e.kind).toBe('UnaryExpr');
    expect(e.op).toBe('!');
  });

  it('parses -x', () => {
    const e = parseExpr('-x') as UnaryExpr;
    expect(e.op).toBe('-');
  });
});

describe('Assignment expressions', () => {
  it('parses x = 42', () => {
    const e = parseExpr('x = 42') as AssignExpr;
    expect(e.kind).toBe('AssignExpr');
    expect(e.op).toBe('=');
    expect((e.target as Identifier).name).toBe('x');
  });

  it('parses x += 1', () => {
    const e = parseExpr('x += 1') as AssignExpr;
    expect(e.op).toBe('+=');
  });

  it('parses member assignment: obj.prop = val', () => {
    const e = parseExpr('obj.prop = val') as AssignExpr;
    expect(e.kind).toBe('AssignExpr');
    expect((e.target as MemberExpr).property).toBe('prop');
  });
});

describe('Call expressions', () => {
  it('parses myFunc()', () => {
    const e = parseExpr('myFunc()') as CallExpr;
    expect(e.kind).toBe('CallExpr');
    expect((e.callee as Identifier).name).toBe('myFunc');
    expect(e.args).toHaveLength(0);
  });

  it('parses greet(a, b)', () => {
    const e = parseExpr('greet(a, b)') as CallExpr;
    expect(e.args).toHaveLength(2);
  });

  it('parses named args: fetch(delay: 500ms)', () => {
    const e = parseExpr('fetch(delay: 500ms)') as CallExpr;
    expect(e.args[0].label).toBe('delay');
    expect((e.args[0].value as DurationLiteral).unit).toBe('ms');
  });

  it('parses chained calls: a().b()', () => {
    const e = parseExpr('a().b()') as CallExpr;
    expect(e.kind).toBe('CallExpr');
    const callee = e.callee as MemberExpr;
    expect(callee.property).toBe('b');
  });
});

describe('Member expressions', () => {
  it('parses a.b.c', () => {
    const e = parseExpr('a.b.c') as MemberExpr;
    expect(e.kind).toBe('MemberExpr');
    expect(e.property).toBe('c');
    expect((e.object as MemberExpr).property).toBe('b');
  });

  it('parses optional chain: a?.b', () => {
    const e = parseExpr('a?.b') as MemberExpr;
    expect(e.optional).toBe(true);
    expect(e.property).toBe('b');
  });
});

describe('Index expressions', () => {
  it('parses arr[0]', () => {
    const e = parseExpr('arr[0]') as IndexExpr;
    expect(e.kind).toBe('IndexExpr');
    expect((e.index as IntegerLiteral).value).toBe(0);
  });

  it('parses dict["key"]', () => {
    const e = parseExpr('dict["key"]') as IndexExpr;
    expect((e.index as StringLiteral).value).toBe('key');
  });
});

describe('Ternary expression', () => {
  it('parses a ? b : c', () => {
    const e = parseExpr('a ? b : c') as TernaryExpr;
    expect(e.kind).toBe('TernaryExpr');
    expect((e.condition as Identifier).name).toBe('a');
    expect((e.consequent as Identifier).name).toBe('b');
    expect((e.alternate as Identifier).name).toBe('c');
  });
});

describe('Await expression', () => {
  it('parses await fetch(url)', () => {
    const e = parseExpr('await fetch(url)') as AwaitExpr;
    expect(e.kind).toBe('AwaitExpr');
    expect(e.expr.kind).toBe('CallExpr');
  });
});

describe('Lambda expressions', () => {
  it('parses x => x + 1 (single param)', () => {
    const e = parseExpr('x => x + 1') as LambdaExpr;
    expect(e.kind).toBe('LambdaExpr');
    expect(e.params[0].name).toBe('x');
  });

  it('parses (a, b) => a + b', () => {
    const e = parseExpr('(a, b) => a + b') as LambdaExpr;
    expect(e.params).toHaveLength(2);
  });

  it('parses (a) => { return a }', () => {
    const e = parseExpr('(a) => { return a }') as LambdaExpr;
    expect(e.body.kind).toBe('Block');
  });
});

// ─── Link-specific operators ──────────────────────────────────────────────────

describe('Pipe operator |>', () => {
  it('parses a |> b', () => {
    const e = parseExpr('a |> b') as PipeExpr;
    expect(e.kind).toBe('PipeExpr');
    expect((e.left as Identifier).name).toBe('a');
    expect((e.fn as Identifier).name).toBe('b');
  });

  it('parses chain: a |> b |> c', () => {
    const e = parseExpr('a |> b |> c') as PipeExpr;
    expect(e.kind).toBe('PipeExpr');
    expect((e.fn as Identifier).name).toBe('c');
    expect((e.left as PipeExpr).kind).toBe('PipeExpr');
  });

  it('parses pipe into call: msg.text |> trim', () => {
    const e = parseExpr('msg.text |> trim') as PipeExpr;
    expect(e.left.kind).toBe('MemberExpr');
  });
});

describe('Retry operator ~>', () => {
  it('parses fetch(url) ~> retry(3)', () => {
    const e = parseExpr('fetch(url) ~> retry(3)') as RetryExpr;
    expect(e.kind).toBe('RetryExpr');
    expect(e.times).toBe(3);
    expect(e.expr.kind).toBe('CallExpr');
  });

  it('parses with delay option: fetch(url) ~> retry(3, delay: 500ms)', () => {
    const e = parseExpr('fetch(url) ~> retry(3, delay: 500ms)') as RetryExpr;
    expect(e.times).toBe(3);
    expect(e.options[0].key).toBe('delay');
    expect((e.options[0].value as DurationLiteral).ms).toBe(500);
  });
});

// ─── Statements ───────────────────────────────────────────────────────────────

describe('Variable declarations', () => {
  it('parses let x = 42', () => {
    const s = firstStmt('let x = 42') as VarDecl;
    expect(s.kind).toBe('VarDecl');
    expect(s.varKind).toBe('let');
    expect(s.name).toBe('x');
    expect((s.init as IntegerLiteral).value).toBe(42);
  });

  it('parses const PI = 3.14', () => {
    const s = firstStmt('const PI = 3.14') as VarDecl;
    expect(s.varKind).toBe('const');
  });

  it('parses flow user = db.get(id)', () => {
    const s = firstStmt('flow user = db.get(id)') as VarDecl;
    expect(s.varKind).toBe('flow');
    expect(s.init?.kind).toBe('CallExpr');
  });

  it('parses let x without init', () => {
    const s = firstStmt('let x') as VarDecl;
    expect(s.name).toBe('x');
    expect(s.init).toBeUndefined();
  });
});

describe('Function declarations', () => {
  it('parses fn greet(name) { return "hi" }', () => {
    const s = firstStmt('fn greet(name) { return "hi" }') as FnDecl;
    expect(s.kind).toBe('FnDecl');
    expect(s.name).toBe('greet');
    expect(s.params[0].name).toBe('name');
    expect(s.isAsync).toBe(false);
  });

  it('parses async fn fetch(url) { }', () => {
    const s = firstStmt('async fn fetch(url) { }') as FnDecl;
    expect(s.isAsync).toBe(true);
  });

  it('parses fn with default params', () => {
    const s = firstStmt('fn greet(name = "World") { }') as FnDecl;
    expect(s.params[0].defaultValue?.kind).toBe('StringLiteral');
  });
});

describe('If statements', () => {
  it('parses simple if', () => {
    const s = firstStmt('if x > 0 { print(x) }') as IfStmt;
    expect(s.kind).toBe('IfStmt');
    expect(s.alternates).toHaveLength(0);
    expect(s.alternate).toBeUndefined();
  });

  it('parses if / else', () => {
    const s = firstStmt('if x { a() } else { b() }') as IfStmt;
    expect(s.alternate).toBeDefined();
  });

  it('parses if / elif / else', () => {
    const s = firstStmt('if a { } elif b { } elif c { } else { }') as IfStmt;
    expect(s.alternates).toHaveLength(2);
    expect(s.alternate).toBeDefined();
  });
});

describe('For statement', () => {
  it('parses for x in list { }', () => {
    const s = firstStmt('for x in list { }') as ForStmt;
    expect(s.kind).toBe('ForStmt');
    expect(s.variable).toBe('x');
    expect((s.iterable as Identifier).name).toBe('list');
  });
});

describe('While statement', () => {
  it('parses while cond { }', () => {
    const s = firstStmt('while running { }') as WhileStmt;
    expect(s.kind).toBe('WhileStmt');
  });
});

describe('Loop statement', () => {
  it('parses loop { }', () => {
    const s = firstStmt('loop { break }') as LoopStmt;
    expect(s.kind).toBe('LoopStmt');
    expect((s.body.body[0] as { kind: string }).kind).toBe('BreakStmt');
  });
});

describe('Try / catch / finally', () => {
  it('parses try { } catch(e) { }', () => {
    const s = firstStmt('try { } catch(e) { }') as TryStmt;
    expect(s.kind).toBe('TryStmt');
    expect(s.catchClause?.param).toBe('e');
  });

  it('parses try with finally', () => {
    const s = firstStmt('try { } finally { }') as TryStmt;
    expect(s.finallyClause).toBeDefined();
  });
});

describe('Return statement', () => {
  it('parses return expr', () => {
    const s = firstStmt('fn f() { return 42 }') as FnDecl;
    const ret = s.body.body[0] as ReturnStmt;
    expect(ret.kind).toBe('ReturnStmt');
    expect((ret.value as IntegerLiteral).value).toBe(42);
  });
});

describe('Import declaration', () => {
  it('parses import "net"', () => {
    const s = firstStmt('import "net"') as ImportDecl;
    expect(s.kind).toBe('ImportDecl');
    expect(s.path).toBe('net');
  });
});

// ─── Link-specific statements ─────────────────────────────────────────────────

describe('event declaration', () => {
  it('parses event user_joined', () => {
    const s = firstStmt('event user_joined') as EventDecl;
    expect(s.kind).toBe('EventDecl');
    expect(s.name).toBe('user_joined');
  });
});

describe('channel declaration', () => {
  it('parses channel bot = link telegram("TOKEN")', () => {
    const s = firstStmt('channel bot = link telegram("TOKEN")') as ChannelDecl;
    expect(s.kind).toBe('ChannelDecl');
    expect(s.name).toBe('bot');
    expect(s.platform).toBe('telegram');
    expect((s.token as StringLiteral).value).toBe('TOKEN');
  });

  it('parses channel with discord', () => {
    const s = firstStmt('channel dc = link discord("DCTOKEN")') as ChannelDecl;
    expect(s.platform).toBe('discord');
  });
});

describe('listen statement', () => {
  it('parses listen bot { }', () => {
    const s = firstStmt('listen bot { }') as ListenStmt;
    expect(s.kind).toBe('ListenStmt');
    expect(s.channels).toEqual(['bot']);
  });

  it('parses listen bot, dc { }', () => {
    const s = firstStmt('listen bot, dc { }') as ListenStmt;
    expect(s.channels).toEqual(['bot', 'dc']);
  });

  it('parses listen with on inside', () => {
    const src = `
listen bot {
  on message(msg) {
    print(msg.text)
  }
}`;
    const s = firstStmt(src) as ListenStmt;
    const inner = s.body.body[0] as OnStmt;
    expect(inner.kind).toBe('OnStmt');
  });
});

describe('on statement', () => {
  it('parses on message(msg) { }', () => {
    const s = firstStmt('on message(msg) { }') as OnStmt;
    expect(s.kind).toBe('OnStmt');
    expect(s.event).toBe('message');
    expect(s.params[0].name).toBe('msg');
  });

  it('parses on message(msg) => expr', () => {
    const s = firstStmt('on message(msg) => print(msg)') as OnStmt;
    expect(s.body.kind).toBe('CallExpr');
  });
});

describe('route statement', () => {
  it('parses route "/start" { }', () => {
    const s = firstStmt('route "/start" { }') as RouteStmt;
    expect(s.kind).toBe('RouteStmt');
    expect(s.pattern).toBe('/start');
    expect(s.routeParams).toHaveLength(0);
  });

  it('parses route params from pattern', () => {
    const s = firstStmt('route "/ban {user} {reason?}" { }') as RouteStmt;
    expect(s.routeParams).toHaveLength(2);
    expect(s.routeParams[0]).toEqual({ name: 'user', isOptional: false });
    expect(s.routeParams[1]).toEqual({ name: 'reason', isOptional: true });
  });

  it('parses route with require clause', () => {
    const src = `route "/ban {user}" {
      require permission: "admin"
    }`;
    const s = firstStmt(src) as RouteStmt;
    expect(s.requires[0].key).toBe('permission');
    expect((s.requires[0].value as StringLiteral).value).toBe('admin');
  });
});

describe('hook statement', () => {
  it('parses hook on_start { }', () => {
    const s = firstStmt('hook on_start { }') as HookStmt;
    expect(s.kind).toBe('HookStmt');
    expect(s.name).toBe('on_start');
  });

  it('parses hook with params: hook on_error(e) { }', () => {
    const s = firstStmt('hook on_error(e) { }') as HookStmt;
    expect(s.params[0].name).toBe('e');
  });
});

describe('emit statement', () => {
  it('parses emit user_joined(data)', () => {
    const s = firstStmt('emit user_joined(data)') as EmitStmt;
    expect(s.kind).toBe('EmitStmt');
    expect(s.event).toBe('user_joined');
  });
});

describe('wait statement', () => {
  it('parses wait 500ms', () => {
    const s = firstStmt('wait 500ms') as WaitStmt;
    expect(s.kind).toBe('WaitStmt');
    expect(s.duration.amount).toBe(500);
    expect(s.duration.unit).toBe('ms');
    expect(s.duration.ms).toBe(500);
  });

  it('parses wait 5s', () => {
    const s = firstStmt('wait 5s') as WaitStmt;
    expect(s.duration.ms).toBe(5000);
  });
});

// ─── Struct declaration ───────────────────────────────────────────────────────

describe('struct declaration', () => {
  it('parses struct User { name age }', () => {
    const src = `struct User {
      name
      age
    }`;
    const s = firstStmt(src) as StructDecl;
    expect(s.kind).toBe('StructDecl');
    expect(s.name).toBe('User');
    expect(s.fields).toHaveLength(2);
    expect(s.fields[0].name).toBe('name');
  });
});

// ─── Full program ─────────────────────────────────────────────────────────────

describe('Full Link programs', () => {
  it('parses hello-world program', () => {
    const src = `
let name = "World"
let version = 1

fn greet(who) {
    return "Hello, {who}!"
}

if version >= 1 {
    print("Stable")
}

for lang in langs {
    print(lang)
}

event user_joined

on user_joined(user) {
    print("Joined: {user.name}")
}

hook on_start {
    print("Started!")
}
`;
    const prog = parse(src);
    expect(prog.kind).toBe('Program');
    expect(prog.body.length).toBeGreaterThan(5);
  });

  it('parses multi-platform bot setup', () => {
    const src = `
import "telegram"
import "discord"

channel tg = link telegram("TG_TOKEN")
channel dc = link discord("DC_TOKEN")

listen tg, dc {
    route "/start" {
        send(ctx.chat, "Hello!")
    }

    route "/weather {city}" {
        data = net.get("https://api.weather.com/{city}") ~> retry(3, delay: 500ms)
        send(ctx.chat, "Weather: {data.temp}°C")
    }

    on message(msg) {
        flow user = db.get(msg.author_id)
        user.msg_count += 1
    }
}

hook on_start {
    log.info("Bot started!")
}
`;
    const prog = parse(src);
    expect(prog.kind).toBe('Program');

    // Check imports
    const imports = prog.body.filter(s => s.kind === 'ImportDecl') as ImportDecl[];
    expect(imports).toHaveLength(2);

    // Check channels
    const channels = prog.body.filter(s => s.kind === 'ChannelDecl') as ChannelDecl[];
    expect(channels).toHaveLength(2);
    expect(channels[0].platform).toBe('telegram');
    expect(channels[1].platform).toBe('discord');

    // Check listen
    const listen = prog.body.find(s => s.kind === 'ListenStmt') as ListenStmt;
    expect(listen.channels).toEqual(['tg', 'dc']);

    // Check hook
    const hook = prog.body.find(s => s.kind === 'HookStmt') as HookStmt;
    expect(hook.name).toBe('on_start');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('Parse errors', () => {
  it('throws ParseError on unexpected token', () => {
    expect(() => parse('let = 42')).toThrow(ParseError);
  });

  it('throws ParseError on unclosed block', () => {
    expect(() => parse('if true {')).toThrow();
  });

  it('includes position in ParseError', () => {
    try {
      parse('let = 42');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).pos).toBeDefined();
    }
  });
});
