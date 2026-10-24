'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moyu', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch) => ipcRenderer.invoke('config:set', patch),
  },
  qr: {
    start: () => ipcRenderer.invoke('qr:start'),
    poll: (token) => ipcRenderer.invoke('qr:poll', token),
  },
  shelf: {
    raw: () => ipcRenderer.invoke('shelf:raw'),
    list: () => ipcRenderer.invoke('shelf:list'),
    cached: () => ipcRenderer.invoke('shelf:cached'),
  },
  openBook: (input) => ipcRenderer.invoke('book:open', input),
  loadChapter: (bookId, chapterId) => ipcRenderer.invoke('chapter:load', { bookId, chapterId }),
  progress: {
    get: () => ipcRenderer.invoke('progress:get'),
    set: (p) => ipcRenderer.invoke('progress:set', p),
  },
  cookie: {
    set: (v) => ipcRenderer.invoke('cookie:set', v),
    get: () => ipcRenderer.invoke('cookie:get'),
  },
  prefs: {
    read: () => ipcRenderer.sendSync('prefs:read'),
    write: (obj) => ipcRenderer.send('prefs:write', obj),
  },
  marks: {
    list: (bookId) => ipcRenderer.invoke('marks:list', bookId),
    save: (m) => ipcRenderer.invoke('marks:save', m),
    // 兩種呼叫方式都支援：remove(bookId, id) 或 remove({ bookId, id })
    remove: (a, b) => ipcRenderer.invoke('marks:remove',
      (a && typeof a === 'object') ? a : { bookId: a, id: b }),
  },
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
    add: (r) => ipcRenderer.invoke('stats:add', r),
  },
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
    config: (cfg) => ipcRenderer.invoke('sync:config', cfg),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
  },
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  boss: (on) => ipcRenderer.invoke('app:boss', on),
  hide: () => ipcRenderer.invoke('app:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  win: {
    min: () => ipcRenderer.invoke('win:min'),
    max: () => ipcRenderer.invoke('win:max'),
    close: () => ipcRenderer.invoke('win:close'),
  },
  onBoss: (cb) => ipcRenderer.on('boss', (_e, on) => cb(on)),
});
