// 使い方: node ladder.js <reps per card per side> <lvA> <lvB> [patchfile]
// lvA と lvB の CPU を全25カード(キャラ組合せ)×左右入替で戦わせ、lvA の勝率を出す
const { Worker } = require('worker_threads'); const fs = require('fs'); const os = require('os');
const reps = +process.argv[2] || 10, A = +process.argv[3], B = +process.argv[4], patchFile = process.argv[5];
const patch = patchFile && patchFile !== '-' ? fs.readFileSync(patchFile, 'utf8') : '';
const file = require('path').join(__dirname, '../../index.html');
const jobs = [];
for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let r = 0; r < reps; r++) { jobs.push({ c0: a, c1: b, lv0: A, lv1: B, aSide: 0 }); jobs.push({ c0: a, c1: b, lv0: B, lv1: A, aSide: 1 }); }
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
  let w = 0, stockDiff = 0, ticks = 0, to = 0, sd = [0, 0], kos = [0, 0];
  for (const r of results) {
    const aWin = r.winner === r.aSide; if (aWin) w++;
    stockDiff += r.stocks[r.aSide] - r.stocks[1 - r.aSide]; ticks += r.ticks; if (r.timeout) to++;
    for (const k of r.kos) { const who = k.pi === r.aSide ? 0 : 1; kos[who]++; if (k.sd) sd[who]++; }
  }
  const n = results.length, p = w / n, e = 1.96 * Math.sqrt(p * (1 - p) / n);
  const s = `Lv${A} vs Lv${B}: Lv${A} 勝率 ${(p * 100).toFixed(1)}% ±${(e * 100).toFixed(1)} (${n}試合, 平均残ストック差 ${(stockDiff / n).toFixed(2)}, 平均 ${(ticks / n / 60).toFixed(0)}秒, タイムアウト ${to}, 自滅率 A ${(sd[0] / Math.max(1, kos[0]) * 100).toFixed(0)}% / B ${(sd[1] / Math.max(1, kos[1]) * 100).toFixed(0)}%, ${((Date.now() - t0) / 1000).toFixed(0)}s)`;
  console.log(s); fs.appendFileSync(require('path').join(__dirname, 'results.md'), s + '\n');
}
