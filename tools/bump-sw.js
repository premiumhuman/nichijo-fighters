// 配信ファイルの内容からハッシュを作り、sw.js の VERSION を更新する: node tools/bump-sw.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const files = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const h = crypto.createHash('sha256'); files.forEach(f => h.update(fs.readFileSync(path.join(root, f))));
const v = 'nf-' + h.digest('hex').slice(0, 12);
const p = path.join(root, 'sw.js'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/const VERSION = '[^']*';/, "const VERSION = '" + v + "';"));
console.log('sw VERSION =', v);
