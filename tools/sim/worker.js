const { parentPort, workerData } = require('worker_threads');
const { loadGame } = require('./load');
const N = loadGame(workerData.file);
if (workerData.patch) new Function('N', workerData.patch)(N);
parentPort.on('message', jobs => {
  const out = [];
  for (const j of jobs) { const r = N.simMatch(j.c0, j.c1, j.lv0, j.lv1); out.push({ ...j, ...r }); }
  parentPort.postMessage(out);
});
