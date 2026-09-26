#!/usr/bin/env node
/**
 * Link Programming Language CLI
 *
 * Commands:
 *   link run <file.lk>     Run Link source file
 *   link check <file.lk>   Syntax check only
 *   link repl              Interactive REPL
 *   link init [dir]        Initialize new Link bot project
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const { Lexer } = require('../dist/lexer/index.js');
  const { Parser } = require('../dist/parser/index.js');
  const { Interpreter } = require('../dist/runtime/interpreter.js');
  const { registerStdlib } = require('../../stdlib/dist/index.js');

  if (!command || command === '--help' || command === '-h') {
    console.log('\x1b[36m%s\x1b[0m', '🔗 Link Programming Language v0.1.0 CLI');
    console.log('Usage: link <command> [file.lk] [options]\n');
    console.log('Commands:');
    console.log('  run <file.lk>    Execute a Link script or bot');
    console.log('  check <file.lk>  Check syntax and parse tree');
    console.log('  repl             Start interactive REPL prompt');
    console.log('  init [name]      Create a new Link bot project template');
    console.log('  lex <file.lk>    Print token stream (debug)');
    process.exit(0);
  }

  switch (command) {
    case 'run': {
      const file = args[1];
      if (!file) {
        console.error('Error: Please specify a .lk file to run. Example: link run hello-world.lk');
        process.exit(1);
      }
      const absolutePath = path.resolve(file);
      if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File '${file}' not found.`);
        process.exit(1);
      }
      const src = fs.readFileSync(absolutePath, 'utf-8');

      const interpreter = new Interpreter();
      registerStdlib(interpreter.globalEnv);

      try {
        await interpreter.run(src, absolutePath);
      } catch (err) {
        console.error('\x1b[31m%s\x1b[0m', `[Runtime Error] ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'check': {
      const file = args[1];
      if (!file) {
        console.error('Error: Please specify a .lk file to check.');
        process.exit(1);
      }
      const absolutePath = path.resolve(file);
      const src = fs.readFileSync(absolutePath, 'utf-8');
      try {
        const lexer = new Lexer(src, absolutePath);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens, src, absolutePath);
        const program = parser.parse();
        console.log('\x1b[32m%s\x1b[0m', `✔ Syntax check passed for '${file}' (${program.body.length} statements parsed).`);
      } catch (err) {
        console.error('\x1b[31m%s\x1b[0m', `✖ Syntax error in '${file}': ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'lex': {
      const file = args[1];
      if (!file) { console.error('Usage: link lex <file.lk>'); process.exit(1); }
      const src = fs.readFileSync(path.resolve(file), 'utf-8');
      const lexer = new Lexer(src, file);
      const tokens = lexer.tokenize();
      for (const tok of tokens) {
        const pos = `${tok.pos.line}:${tok.pos.column}`;
        console.log(`[${pos.padEnd(8)}] ${tok.type.padEnd(20)} ${JSON.stringify(tok.value)}`);
      }
      break;
    }

    case 'repl': {
      console.log('\x1b[36m%s\x1b[0m', '🔗 Link Interactive REPL v0.1.0');
      console.log('Type Link statements or exit with .exit or Ctrl+C\n');

      const interpreter = new Interpreter();
      registerStdlib(interpreter.globalEnv);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'link> ',
      });

      rl.prompt();

      rl.on('line', async (line) => {
        const input = line.trim();
        if (input === '.exit') {
          rl.close();
          return;
        }
        if (!input) {
          rl.prompt();
          return;
        }

        try {
          const lexer = new Lexer(input, '<repl>');
          const tokens = lexer.tokenize();
          const parser = new Parser(tokens, input, '<repl>');
          const program = parser.parse();
          for (const stmt of program.body) {
            const res = await interpreter.evaluateStatement(stmt, interpreter.globalEnv);
            if (stmt.kind === 'ExprStmt' && res.type !== 'null') {
              console.log(interpreter.evaluateBinaryOp ? require('../dist/runtime/value.js').stringifyValue(res) : res);
            }
          }
        } catch (err) {
          console.error('\x1b[31m%s\x1b[0m', `Error: ${err.message}`);
        }
        rl.prompt();
      });

      rl.on('close', () => {
        console.log('\nBye!');
        process.exit(0);
      });
      break;
    }

    case 'init': {
      const projName = args[1] || 'my-link-bot';
      const dirPath = path.resolve(projName);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const mainFile = path.join(dirPath, 'main.lk');
      const botCode = `// ${projName} — Link bot project template
import "telegram"

channel tg = link telegram(env("TG_TOKEN", "your_bot_token"))

listen tg {
    route "/start" {
        send(ctx.chat, "Привет! Я бот на языке Link 🚀")
    }

    on message(msg) {
        send(msg.chat_id, "Эхо: " + msg.text)
    }
}

hook on_start {
    log.info("Бот успешно запущен!")
}
`;
      fs.writeFileSync(mainFile, botCode);
      console.log('\x1b[32m%s\x1b[0m', `✔ Created new Link bot project in '${projName}'!`);
      console.log(`\nTo run your bot:\n  cd ${projName}\n  link run main.lk\n`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}. Use link --help for available commands.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
