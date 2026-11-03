'use strict';

/* 啟動 Electron 用的乾淨環境
   ─────────────────────────────────────────────────────────────
   這台機器（某些 session、某些工具鏈）會帶著 ELECTRON_RUN_AS_NODE=1，
   那會讓 electron.exe 當成普通 Node 跑 → main.js 第一行 require('electron') 就炸。
   所有測試／腳本要 spawn electron.exe 時都用這一份環境。 */

function appEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

module.exports = appEnv;
