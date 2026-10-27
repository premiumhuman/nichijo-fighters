// 必殺技の撃墜率を測る(ヘッドレス)。index.html のゲームをそのまま使う。
//   相手の%を固定(既定 50/70/100)し、ステージのいろいろな位置・向きで必殺技を「当てて」、ふっとばしで撃墜できた割合を出す。
//   相手は「ずらし無し」: ふっとび中(hitstun/固定中)は入力なし。ふっとびが終わったら CPU Lv7 が本気で復帰を試みる。
//   KO = 300フレーム以内に撃墜。launch = ふっとび中(操作が戻る前)に場外へ出た撃墜(=純粋なふっとばし撃墜)。
//   相手キャラは5キャラ全部(重さが違う)、位置は攻撃側 x を 8か所 × 左右の向き × 距離2種類。
// 使い方: node tools/sim/ko.js [--pcts 50,70,100] [--file index.html] [--reps 2] [--json out.json]
const path = require('path'), fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const file = path.resolve(arg('file', path.join(__dirname, '../../index.html')));
const pcts = arg('pcts', '50,70,100').split(',').map(Number), reps = +arg('reps', 2);
let N = require('./load').loadGame(file), g = N.game;
const IDS = N.CHARS.map(c => c.id);
function setGame(n) { N = n; g = n.game; }
// 必殺技ごとの「当たる距離」(近め/遠め)
const DIST = { neko: [110, 230], ninjin: [180, 420], mug: [40, 80], brush: [160, 380], edamame: [170, 380] };
const XS = [340, 420, 500, 580, 660, 740, 820, 900];
function trial(ai, ti, pct, ax, dir, dist) {
  g.sel[0].ci = ai; g.sel[1].ci = ti; g.ctrl = [0, 0]; N.startMatch(); g.countdown = 0; g.goTimer = 0;
  const a = g.fighters[0], b = g.fighters[1], tx = ax + dir * dist;
  if (tx < N.STAGE.x1 + 20 || tx > N.STAGE.x2 - 20) return null;
  Object.assign(a, { x: ax, y: N.STAGE.y, facing: dir, state: 'idle', grounded: true, meter: 100 });
  Object.assign(b, { x: tx, y: N.STAGE.y, facing: -dir, state: 'idle', grounded: true, percent: pct });
  N.doSuper(a, {});
  let hitT = -1, ko = false, launch = false, freed = false, finHit = false;
  for (let t = 0; t < 520; t++) {
    N.simStep();
    if (a.stats.superHits > 0 && hitT < 0) hitT = t;
    if (b.state === 'hitstun' && b.lastSuper && !(a.state === 'attack' && a.move && a.move.super && a.move.small && a.t - a.move.startup < a.move.finFrom) && b.stunLen > 20) finHit = true;
    if (b.stocks < 3) { ko = true; launch = !freed; break; }
    // ふっとびが終わったら(操作が戻ったら)CPU Lv7 が復帰する
    if (hitT >= 0 && !freed && finHit && !['hitstun', 'locked'].includes(b.state)) { freed = true; g.ais[1] = new N.CpuAI(1, 7); }
    if (hitT < 0 && !(a.state === 'attack' && a.move && a.move.super) && t > 10) break;   // 外れた
    if (freed && b.grounded && N.STAGE && b.x > N.STAGE.x1 && b.x < N.STAGE.x2 && t - hitT > 60) break; // ステージに戻れた
  }
  return { hit: hitT >= 0, ko, launch };
}
function rate(ai, pct, reps) { let hit = 0, ko = 0, la = 0, n = 0; for (let ti = 0; ti < IDS.length; ti++) for (let r = 0; r < reps; r++) for (const x of XS) for (const dir of [1, -1]) for (const d of DIST[IDS[ai]]) { const res = trial(ai, ti, pct, x, dir, d); if (!res) continue; n++; if (res.hit) { hit++; if (res.ko) ko++; if (res.launch) la++; } } return { ko: ko / hit, launch: la / hit, hit, n }; }
if (require.main !== module) { module.exports = { setGame, rate, trial, IDS }; return; }
const out = {};
console.log('必殺技の撃墜率(当たった時。ずらし無し・ふっとび後は CPU Lv7 が復帰) / launch=ふっとび中に場外');
for (let ai = 0; ai < IDS.length; ai++) {
  const id = IDS[ai]; out[id] = {};
  const line = [];
  for (const pct of pcts) {
    let n = 0, hit = 0, ko = 0, la = 0; const per = {};
    for (let ti = 0; ti < IDS.length; ti++) {
      let pn = 0, pk = 0;
      for (let r = 0; r < reps; r++) for (const x of XS) for (const dir of [1, -1]) for (const d of DIST[id]) {
        const res = trial(ai, ti, pct, x, dir, d); if (!res) continue; n++;
        if (res.hit) { hit++; pn++; if (res.ko) { ko++; pk++; } if (res.launch) la++; }
      }
      per[IDS[ti]] = pn ? Math.round(100 * pk / pn) : null;
    }
    out[id][pct] = { trials: n, hits: hit, koRate: hit ? ko / hit : 0, launchRate: hit ? la / hit : 0, perTarget: per };
    line.push(`${pct}%: KO ${(100 * ko / hit).toFixed(0)}% (launch ${(100 * la / hit).toFixed(0)}%) [${Object.entries(per).map(([k, v]) => k + ' ' + v).join(', ')}] hit ${hit}/${n}`);
  }
  console.log(`\n${N.SUPERS[id].name} (${N.CHARS[ai].name})\n  ` + line.join('\n  '));
}
const j = arg('json', null); if (j) fs.writeFileSync(j, JSON.stringify(out, null, 1));
