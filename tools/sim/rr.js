// 並列総当たり(ラウンドロビン): 5x5 の全カードを「左右入替・同じ試合数」で CPU 同士に戦わせ、
// 全 CPU コアに子プロセス(child_process.fork)で分散して、キャラ別勝率と 5x5 相性表(95%信頼区間つき)を出す。
// ゲームの数値は一切変更しない(index.html をそのまま読み込む。--patch を付けた時だけ、そのファイルを実行してから試合)。
//
// 使い方: node tools/sim/rr.js [--lv 4] [--games 40] [--procs 8] [--lv2 <相手Lv>] [--patch file.js] [--json out.json] [--file index.html] [--quiet]
//   --lv     CPU レベル(1〜7)。両者このレベル(--lv2 があれば側1 はそのレベル、左右入替で公平に)
//   --games  1カード(キャラA vs キャラB)あたり「各サイド」の試合数。A×B は A左 games 試合 + A右 games 試合
//   --procs  子プロセス数(既定 = CPU コア数)
//   例: node tools/sim/rr.js --lv 7 --games 60   → 25カード×2サイド×60 = 3000試合
const { fork } = require('child_process');
const os = require('os'), fs = require('fs'), path = require('path');
if (process.argv[2] === '--child') return child();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);
const lv = +arg('lv', 4), lv2 = +arg('lv2', lv), games = +arg('games', 40), procs = +arg('procs', os.cpus().length);
const file = path.resolve(arg('file', path.join(__dirname, '../../index.html')));
const patchFile = arg('patch', null), jsonOut = arg('json', null), quiet = has('quiet');
const { loadGame } = require('./load');
const NAMES = loadGame(file).CHARS.map(c => c.name), NC = NAMES.length;
// ジョブ: 順序つきカード (a,b) × games。(a,b) と (b,a) の両方があるので、どの組合せも左右が同数になる
// lv と lv2 が違う時は、さらにレベルの左右も入れ替える(各カードで半分ずつ)
const jobs = [];
for (let a = 0; a < NC; a++) for (let b = 0; b < NC; b++) for (let r = 0; r < games; r++) {
  const swapLv = lv !== lv2 && r % 2 === 1;
  jobs.push({ c0: a, c1: b, lv0: swapLv ? lv2 : lv, lv1: swapLv ? lv : lv2 });
}
// 長い試合と短い試合が偏らないよう、混ぜてから小分けにして配る(空いた子に次の束を渡す)
for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
const BATCH = Math.max(1, Math.min(8, Math.floor(jobs.length / (procs * 6))));
let next = 0, alive = 0; const results = []; const t0 = Date.now();
const progress = () => { if (!quiet && process.stderr.isTTY) process.stderr.write(`\r${results.length}/${jobs.length} 試合 (${((Date.now() - t0) / 1000).toFixed(0)}s)`); };
for (let p = 0; p < Math.min(procs, jobs.length); p++) {
  const ch = fork(__filename, ['--child'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] }); alive++;
  const feed = () => { if (next < jobs.length) { ch.send({ jobs: jobs.slice(next, next + BATCH) }); next += BATCH; } else ch.send({ done: true }); };
  ch.on('message', m => { if (m.ready) { ch.send({ init: { file, patchFile } }); return; } if (m.inited) return feed(); results.push(...m.res); progress(); feed(); });
  ch.on('exit', code => { if (code) { console.error('child exited with code ' + code); process.exit(1); } if (--alive === 0) finish(); });
}
function wilson(w, n) {   // 95% 信頼区間(Wilson)
  if (!n) return [NaN, NaN, NaN]; const z = 1.96, p = w / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [p * 100, (c - h) * 100, (c + h) * 100];
}
function finish() {
  if (!quiet && process.stderr.isTTY) process.stderr.write('\n');
  const ch = NAMES.map(() => ({ w: 0, n: 0 })), mu = NAMES.map(() => NAMES.map(() => ({ w: 0, n: 0 })));
  let side0 = 0, timeouts = 0, ticks = 0, lvA = { w: 0, n: 0 };
  for (const r of results) {
    if (r.winner === 0) side0++; if (r.timeout) timeouts++; ticks += r.ticks;
    if (lv !== lv2) { lvA.n++; if ((r.lv0 === lv) === (r.winner === 0)) lvA.w++; }
    if (r.c0 === r.c1) continue;
    mu[r.c0][r.c1].n++; mu[r.c1][r.c0].n++; mu[r.winner === 0 ? r.c0 : r.c1][r.winner === 0 ? r.c1 : r.c0].w++;
    ch[r.c0].n++; ch[r.c1].n++; ch[r.winner === 0 ? r.c0 : r.c1].w++;
  }
  const f = x => x.toFixed(1), sec = ((Date.now() - t0) / 1000).toFixed(1);
  let s = `## 総当たり CPU Lv${lv}${lv2 !== lv ? ' vs Lv' + lv2 : ''} 同士 (1カード各サイド ${games} 試合, 計 ${results.length} 試合, ${procs} プロセス, ${sec}s)\n\n`;
  s += '### キャラ別勝率(ミラー除く)\n\n| キャラ | 勝率 | 95%CI | 試合数 | 判定 |\n|---|---|---|---|---|\n';
  NAMES.forEach((n, i) => { const [p, lo, hi] = wilson(ch[i].w, ch[i].n); s += `| ${n} | ${f(p)}% | ${f(lo)}–${f(hi)} | ${ch[i].n} | ${p >= 45 && p <= 55 ? 'OK' : p < 45 ? '弱い' : '強い'} |\n`; });
  s += '\n### 相性表(行キャラの勝率 vs 列キャラ, 95%CI)\n\n| 行\\列 | ' + NAMES.join(' | ') + ' |\n|' + '---|'.repeat(NC + 1) + '\n';
  let worst = null;
  NAMES.forEach((n, i) => {
    s += `| ${n} | ` + NAMES.map((m, j) => {
      if (i === j) return '—';
      const [p, lo, hi] = wilson(mu[i][j].w, mu[i][j].n);
      if (i < j && (!worst || Math.abs(p - 50) > Math.abs(worst.p - 50))) worst = { p, a: n, b: m };
      return `${f(p)}% (${f(lo)}–${f(hi)})${p < 35 || p > 65 ? ' ⚠' : ''}`;
    }).join(' | ') + ' |\n';
  });
  const [sp, slo, shi] = wilson(side0, results.length);
  s += `\n- 左側(側0)の勝率: ${f(sp)}% (${f(slo)}–${f(shi)}) / タイムアウト ${timeouts} / 平均試合時間 ${(ticks / results.length / 60).toFixed(0)}秒\n`;
  if (lv !== lv2) { const [p, lo, hi] = wilson(lvA.w, lvA.n); s += `- Lv${lv} の Lv${lv2} に対する勝率: ${f(p)}% (${f(lo)}–${f(hi)})\n`; }
  if (worst) s += `- いちばん偏った相性: ${worst.a} vs ${worst.b} = ${f(worst.p)}%(${worst.p < 35 || worst.p > 65 ? '目標 35〜65% の範囲外 ⚠' : '目標 35〜65% の範囲内'})\n`;
  console.log(s);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ lv, lv2, games, procs, seconds: +sec, names: NAMES, perChar: ch, matchups: mu, side0, timeouts, n: results.length }, null, 1));
}
function child() {
  let N = null;
  process.on('message', m => {
    if (m.init) {
      N = require('./load').loadGame(m.init.file);
      if (m.init.patchFile) new Function('N', fs.readFileSync(m.init.patchFile, 'utf8'))(N);
      process.send({ inited: true });
    } else if (m.jobs) process.send({ res: m.jobs.map(j => { const r = N.simMatch(j.c0, j.c1, j.lv0, j.lv1); return { ...j, winner: r.winner, ticks: r.ticks, timeout: !!r.timeout }; }) });
    else if (m.done) process.exit(0);
  });
  process.send({ ready: true });
}
