// アプリアイコン(PNG)をゲームのキャラ描画コードから生成する: node tools/make-icons.js
// 必要: playwright (npm i playwright)
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const root = path.join(__dirname, '..');
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(root, 'index.html')); await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    const { ctx, CHARS, drawCharBody } = __NF, cv = ctx.canvas;
    function draw(size, safe) {
      cv.width = size; cv.height = size; const k = size / 512;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#1b2350'); g.addColorStop(0.62, '#3a2f7a'); g.addColorStop(1, '#4a3270');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + (i % 3) * 0.2) + ')'; ctx.fillRect((i * 97.3) % 512, (i * 53.7) % 250, 4, 4); }
      ctx.fillStyle = 'rgba(255,240,200,0.18)'; ctx.beginPath(); ctx.arc(400, 104, 70, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff0c8'; ctx.beginPath(); ctx.arc(400, 104, 40, 0, 7); ctx.fill();
      const sc = safe ? 0.78 : 1;            // マスカブルは中央80%に収める
      ctx.translate(256, 256); ctx.scale(sc, sc); ctx.translate(-256, -256);
      // 衝撃の星
      ctx.fillStyle = '#ffd23d'; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 120 : 196; ctx.lineTo(256 + Math.cos(a) * r, 236 + Math.sin(a) * r * 0.9); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7a3d'; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + 0.13, r = i % 2 ? 84 : 140; ctx.lineTo(256 + Math.cos(a) * r, 236 + Math.sin(a) * r * 0.9); }
      ctx.closePath(); ctx.fill();
      // 地面
      ctx.fillStyle = '#232a52'; ctx.fillRect(-200, 418, 912, 300);
      ctx.fillStyle = '#b8f2e6'; ctx.fillRect(-200, 412, 912, 12);
      const put = (ci, x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawCharBody(CHARS[ci], CHARS[ci].color, f, { t: 0 }); ctx.restore(); };
      put(1, 72, 414, 1.95, 1); put(3, 452, 414, 1.95, -1); put(2, 344, 416, 2.25, -1); put(0, 178, 418, 2.55, 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return cv.toDataURL('image/png');
    }
    return { a192: draw(192), a512: draw(512), m512: draw(512, true), apple: draw(180), fav: draw(64) };
  });
  const save = (n, d) => fs.writeFileSync(path.join(root, 'icons', n), Buffer.from(d.split(',')[1], 'base64'));
  save('icon-192.png', out.a192); save('icon-512.png', out.a512); save('icon-maskable-512.png', out.m512); save('apple-touch-icon.png', out.apple);
  await b.close(); console.log('icons written');
})();
