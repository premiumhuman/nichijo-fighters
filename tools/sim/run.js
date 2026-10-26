// 使い方: node run.js <reps per side> <lv> [patchfile] [label]
const { Worker } = require('worker_threads'); const fs = require('fs'); const os = require('os');
const reps = +process.argv[2] || 50, lv = +process.argv[3] || 4, patchFile = process.argv[4], label = process.argv[5] || 'run';
const patch = patchFile && patchFile !== '-' ? fs.readFileSync(patchFile, 'utf8') : '';
const file = require('path').join(__dirname, '../../index.html');
const jobs = [];
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let r = 0; r < reps; r++) jobs.push({ c0: a, c1: b, lv0: lv, lv1: lv });
const nW = os.cpus().length; const chunks = Array.from({ length: nW }, () => []);
jobs.forEach((j, i) => chunks[i % nW].push(j));
const t0 = Date.now(); let done = 0; const results = [];
chunks.forEach(ch => {
  const w = new Worker(__dirname + '/worker.js', { workerData: { file, patch } });
  w.on('message', res => { results.push(...res); w.terminate(); if (++done === nW) finish(); });
  w.on('error', e => { console.error(e); process.exit(1); });
  w.postMessage(ch);
});
function finish() {
  const names = ['ネコ', 'ニンジン', 'マグ', 'ハブラシ'];
  const ch = names.map(() => ({ w: 0, n: 0 })); const mu = names.map(() => names.map(() => ({ w: 0, n: 0 })));
  let ticks = 0, timeouts = 0, side0 = 0, nonMirror = 0; const koPct = names.map(() => []); let sd = 0, kos = 0; const sdBy = names.map(() => 0), deaths = names.map(() => 0);
  for (const r of results) {
    const cw = r.winner === 0 ? r.c0 : r.c1, cl = r.winner === 0 ? r.c1 : r.c0;
    ticks += r.ticks; if (r.timeout) timeouts++;
    if (r.winner === 0) side0++;
    mu[r.c0][r.c1].n++; if (r.winner === 0) mu[r.c0][r.c1].w++;
    mu[r.c1][r.c0].n++; if (r.winner === 1) mu[r.c1][r.c0].w++;
    if (r.c0 !== r.c1) { ch[r.c0].n++; ch[r.c1].n++; ch[cw].w++; nonMirror++; }
    for (const k of r.kos) { kos++; const vc = k.pi === 0 ? r.c0 : r.c1; deaths[vc]++; if (k.sd) { sd++; sdBy[vc]++; } else koPct[k.pi === 0 ? r.c0 : r.c1].push(k.pct); }
  }
  const ci = (w, n) => { const p = w / n; return [p * 100, 1.96 * Math.sqrt(p * (1 - p) / n) * 100]; };
  let s = `## ${label} (CPU Lv${lv} 同士, 各カード ${reps}試合×左右入替, 計 ${results.length}試合, ${((Date.now() - t0) / 1000).toFixed(0)}s)\n\n`;
  s += '| キャラ | 勝率(ミラー除く) | 95%CI | 試合数 | 撃墜された時の平均% | 自滅率 |\n|---|---|---|---|---|---|\n';
  names.forEach((n, i) => { const [p, e] = ci(ch[i].w, ch[i].n); const kp = koPct[i]; s += `| ${n} | ${p.toFixed(1)}% | ±${e.toFixed(1)} | ${ch[i].n} | ${(kp.reduce((a, b) => a + b, 0) / kp.length).toFixed(0)}% | ${(sdBy[i] / deaths[i] * 100).toFixed(0)}% |\n`; });
  s += '\n対戦表(行キャラの勝率, 左右両方):\n\n| | ' + names.join(' | ') + ' |\n|---|---|---|---|---|\n';
  names.forEach((n, i) => { s += '| ' + n + ' | ' + names.map((_, j) => (mu[i][j].w / mu[i][j].n * 100).toFixed(0) + '%').join(' | ') + ' |\n'; });
  s += `\n平均試合時間 ${(ticks / results.length / 60).toFixed(1)}秒, タイムアウト ${timeouts}, P1側勝率 ${(side0 / results.length * 100).toFixed(1)}%, 自滅率(被弾なしの落下) ${(sd / kos * 100).toFixed(1)}%\n`;
  console.log(s); fs.appendFileSync(require('path').join(__dirname, 'results.md'), s + '\n');
}
