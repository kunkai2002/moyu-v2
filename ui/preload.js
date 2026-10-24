'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moyu', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch) => ipcRenderer.invoke('config:set', patch),
  },
  login: () => ipcRenderer.invoke('login:open'),
  shelf: {
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
