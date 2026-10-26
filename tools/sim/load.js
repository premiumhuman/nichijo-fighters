// index.html のゲームコードをそのまま Node の vm で実行する(描画はスタブ)
const fs = require('fs'), vm = require('vm');
function loadGame(file) {
  const html = fs.readFileSync(file, 'utf8');
  const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const noop = () => {};
  const ctxStub = new Proxy({}, { get: (t, k) => k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
  const canvas = { style: {}, width: 0, height: 0, getContext: () => ctxStub, focus: noop };
  const sandbox = { console, Math, Set, Map, Object, Array, JSON, Proxy, performance: { now: () => 0 },
    document: { getElementById: () => canvas, addEventListener: noop }, addEventListener: noop, requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    navigator: { userAgent: 'node', maxTouchPoints: 0 }, location: { protocol: 'file:' }, Image: function () {}, setTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'index.html' });
  return sandbox.__NF;
}
module.exports = { loadGame };
