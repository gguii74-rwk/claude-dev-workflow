#!/usr/bin/env node
// mr-review.mjs — mr-review 스킬의 결정적 단계 CLI(SC-6). 모든 오류는 stdout `ERR <메시지>` 한 줄 + exit 2.
//   collect · check · deploy · pack · review-validate · verdict · render · cleanup — 각 lib 모듈이 구현(task-02~06).
import { loadAdapter, parseArgs, AdapterError } from './lib/adapter.mjs';
import { cmdCollect } from './lib/collect.mjs';
import { cmdCheck } from './lib/check.mjs';
import { cmdDeploy } from './lib/deploy.mjs';

export class CliError extends Error {
  constructor(message, code = 2) { super(message); this.code = code; }
}

// 서브커맨드 → async (args, ctx) => string(stdout 첫 줄). ctx = { adapter, work }
const COMMANDS = {
  collect: cmdCollect,
  check: cmdCheck,
  deploy: cmdDeploy,
  // task-05: pack
  // task-06: 'review-validate', verdict, render, cleanup
};

const KNOWN = ['collect', 'check', 'deploy', 'pack', 'review-validate', 'verdict', 'render', 'cleanup'];
const NEEDS_ADAPTER = new Set(['collect', 'check', 'deploy', 'pack', 'verdict', 'render', 'cleanup']);

export async function main(argv) {
  const [sub, ...rest] = argv;
  const args = parseArgs(rest);
  if (!KNOWN.includes(sub)) throw new CliError(`알 수 없는 서브커맨드: ${sub ?? '(없음)'} — ${KNOWN.join('|')}`);
  const ctx = {};
  if (NEEDS_ADAPTER.has(sub)) {
    if (!args.adapter) throw new CliError('--adapter <어댑터 파일> 이 필요하다(또는 MR_REVIEW_ADAPTER)');
    ctx.adapter = loadAdapter(args.adapter);
    if (!args.work) throw new CliError('--work <작업 디렉터리> 가 필요하다');
    ctx.work = args.work;
  }
  const handler = COMMANDS[sub];
  if (!handler) throw new CliError(`${sub}: 아직 구현되지 않았다`);
  return handler(args, ctx);
}

export function register(name, fn) { COMMANDS[name] = fn; }

main(process.argv.slice(2)).then((line) => {
  process.stdout.write(`${line}\n`);
}).catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stdout.write(`ERR ${msg}\n`);
  process.exitCode = Number.isInteger(e?.code) && e.code > 0 && e.code < 256 ? e.code : 2;
  if (!(e instanceof CliError) && !(e instanceof AdapterError)) process.stderr.write(`${e?.stack ?? ''}\n`);
});
