'use strict';

/* 應用程式「有哪些檔案算程式本體」的唯一清單。
   pack4.js（打包到 dist）和 publish-app.js（發佈到雲端）都吃這一份，
   不要兩邊各寫一份，漏一個檔案就是一個鬼故事。 */

const FILES = [
  'server.js', 'main.js', 'package.json', 'ui/preload.js', 'README.md', '啟動.cmd',
  'src/fanqie.js', 'src/store.js', 'src/appapi.js', 'src/comments.js',
  'src/login.js', 'src/shelf.js', 'src/sync.js', 'src/updater.js',
  'src/prefetch.js', 'src/booksearch.js', 'src/search.js', 'src/charset.json',
  'src/sign/index.js', 'src/sign/sm3.js', 'src/sign/cipher.js', 'src/sign/protobuf.js',
  'ui/index.html', 'ui/prefs.js', 'ui/icons.js', 'ui/chrome.js', 'ui/motion.js',
  'ui/polish.js', 'ui/flow.js', 'ui/layout.js', 'ui/shell.js', 'ui/phone.js',
  'ui/remember.js', 'ui/theme.css', 'ui/app.js', 'ui/bridge-http.js',
  '開機自動啟動.cmd', 'tools/autostart.vbs', 'tools/start.vbs', 'tools/launch.vbs',
  'tools/update.cmd',
  'ui/wiring.js', 'ui/wiring2.js', 'ui/wiring3.js', 'ui/wiring4.js', 'ui/wiring5.js',
  'ui/wiring6.js', 'ui/wiring7.js', 'ui/wiring8.js', 'ui/wiring9.js', 'ui/wiring10.js',
  'ui/wiring11.js', 'ui/wiring12.js', 'ui/wiring13.js',
];

module.exports = { FILES };
