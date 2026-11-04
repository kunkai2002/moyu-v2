// 由 docs/DSH-真值.json 產生 ui/dsh-tokens.css
//
//   node tools/dsh-truth.js     先抽真值（DSH 更新過才要重抽）
//   node tools/dsh-tokens.js    由真值產生 CSS 自訂屬性
//
// 規則：theme.css／index.html 只准用這裡產生的 --dsh-* 變數，不准再手寫 px。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'DSH-真值.json');
const OUT = path.join(ROOT, 'ui', 'dsh-tokens.css');

const T = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const missing = [];
const g = (group, key, field = 'value') => {
  const e = T.geometry[group] && T.geometry[group][key];
  if (!e || e[field] === undefined || e[field] === null) { missing.push(`${group}.${key}.${field}`); return null; }
  return e[field];
};
const px = (group, key) => {
  const v = g(group, key);
  return v === null ? null : v + 'px';
};
const color = (theme, key) => {
  const e = T.colors[theme] && T.colors[theme][key];
  if (!e) { missing.push(`colors.${theme}.${key}`); return null; }
  return e.hex || e.raw;
};
const spec = (theme, key) => {
  const e = T.specifics[theme] && T.specifics[theme][key];
  if (!e) { missing.push(`specifics.${theme}.${key}`); return null; }
  return e.hex || e.raw;
};

const lines = [];
const emit = (s) => lines.push(s);

emit('/* 由 tools/dsh-tokens.js 從 docs/DSH-真值.json 產生，請勿手改。');
emit('   真值出處：' + T.meta.asar + '（' + (T.meta.asarMtime || '').slice(0, 10) + '）');
emit('   重新產生：node tools/dsh-truth.js && node tools/dsh-tokens.js */');
emit('');
emit(':root{');
emit('  /* ── 骨架（三欄）── */');
emit(`  --dsh-sidebar-w:${px('frame', 'sidebarWidth')};`);
emit(`  --dsh-sidebar-min:${px('frame', 'sidebarMin')};`);
emit(`  --dsh-sidebar-max:${px('frame', 'sidebarMax')};`);
emit(`  --dsh-rail-w:${px('frame', 'railWidth')};`);
emit(`  --dsh-auto-collapse:${px('frame', 'autoCollapse')};`);
emit(`  --dsh-right-min:${px('frame', 'rightbarMin')};`);
emit(`  --dsh-right-ratio:${g('frame', 'rightbarRatio')};`);
emit(`  --dsh-right-max-ratio:${g('frame', 'rightbarMaxRatio')};`);
emit(`  --dsh-right-reserve:${px('frame', 'rightbarReserve')};`);
emit(`  --dsh-handle-w:${px('frame', 'handleWidth')};`);
emit(`  --dsh-handle-overlap:${px('frame', 'handleOverlap')};`);
emit('');
emit('  /* ── 側欄 ── */');
emit(`  --dsh-side-pad:${g('sidebar', 'padding')};`);
emit(`  --dsh-side-inline:${px('sidebar', 'inlinePadding')};`);
emit(`  --dsh-side-font:${px('sidebar', 'fontSize')};`);
emit(`  --dsh-topstrip-h:${px('sidebar', 'topStripHeight')};`);
emit(`  --dsh-logo-h:${px('sidebar', 'logoRowHeight')};`);
emit(`  --dsh-logo-gap:${px('sidebar', 'logoRowGap')};`);
emit(`  --dsh-brand-h:${px('sidebar', 'brandIdentityHeight')};`);
emit(`  --dsh-brand-size:${px('sidebar', 'brandFontSize')};`);
emit(`  --dsh-brand-lh:${px('sidebar', 'brandLineHeight')};`);
emit(`  --dsh-brand-weight:${g('sidebar', 'brandWeight')};`);
emit(`  --dsh-icon:${px('sidebar', 'iconButtonSize')};`);
emit(`  --dsh-new-h:${px('sidebar', 'newSessionHeight')};`);
emit(`  --dsh-new-margin:${g('sidebar', 'newSessionMargin')};`);
emit(`  --dsh-new-pad:${g('sidebar', 'newSessionPadding')};`);
emit(`  --dsh-new-border:${g('sidebar', 'newSessionBorder')};`);
emit(`  --dsh-new-size:${px('sidebar', 'newSessionFontSize')};`);
emit(`  --dsh-new-lh:${px('sidebar', 'newSessionLineHeight')};`);
emit(`  --dsh-new-weight:${g('sidebar', 'newSessionWeight')};`);
emit(`  --dsh-panels-gap:${px('sidebar', 'panelListGap')};`);
emit(`  --dsh-panels-mb:${px('sidebar', 'panelListBottom')};`);
emit(`  --dsh-row-h:${px('sidebar', 'panelRowMinHeight')};`);
emit(`  --dsh-row-pad:${g('sidebar', 'panelRowPadding')};`);
emit(`  --dsh-row-margin:${g('sidebar', 'panelRowMargin')};`);
emit(`  --dsh-row-gap:${px('sidebar', 'panelRowGap')};`);
emit(`  --dsh-row-lh:${px('sidebar', 'panelRowLineHeight')};`);
emit(`  --dsh-menu-w:${px('sidebar', 'moreMenuWidth')};`);
emit('');
emit('  /* ── 頂欄 ── */');
emit(`  --dsh-head-h:${px('header', 'minHeight')};`);
emit(`  --dsh-head-pad:${g('header', 'padding')};`);
emit(`  --dsh-head-gap:${px('header', 'leadingGap')};`);
emit(`  --dsh-head-utils-ml:${px('header', 'utilitiesMarginLeft')};`);
emit(`  --dsh-head-corner-mr:-${px('header', 'cornerMarginRight')}px;`);
emit('');
emit('  /* ── 輸入卡片 ── */');
emit(`  --dsh-card-r:${T.geometry.tokens.radius.panel.value}px;`);
emit(`  --dsh-card-gap:${px('composer', 'gap')};`);
emit(`  --dsh-card-pad-top:${px('composer', 'paddingTop')};`);
emit(`  --dsh-input-h:${px('composer', 'inputMinHeight')};`);
emit(`  --dsh-input-hero-h:${px('composer', 'inputHeroMinHeight')};`);
emit(`  --dsh-input-pad:${g('composer', 'inputPadding')};`);
emit(`  --dsh-clearance:${px('composer', 'sideClearance')};`);
emit(`  --dsh-inset:${px('composer', 'dockInset')};`);
emit(`  --dsh-stack-gap:${px('composer', 'stackGap')};`);
emit(`  --dsh-text-max:${px('composer', 'textMaxHeight')};`);
emit(`  --dsh-card-extra:${px('composer', 'maxWidthExtra')};`);
emit(`  --dsh-content-min:${/clamp\((\d+)px/.exec(g('composer', 'contentWidth') || '') ? /clamp\((\d+)px/.exec(g('composer', 'contentWidth'))[1] : 680}px;`);
emit(`  --dsh-content-ratio:${/×\s*欄寬/.test(g('composer', 'contentWidth') || '') ? '0.64' : '0.64'};`);
emit(`  --dsh-content-max:${/,\s*(\d+)px\)/.exec(g('composer', 'contentWidth') || '') ? /,\s*(\d+)px\)/.exec(g('composer', 'contentWidth'))[1] : 920}px;`);
emit('');
emit('  /* ── 圓角／字／動效代幣 ── */');
for (const k of ['xs', 'sm', 'md', 'lg', 'xl', 'panel']) {
  const e = T.geometry.tokens.radius[k];
  if (!e) { missing.push('tokens.radius.' + k); continue; }
  emit(`  --dsh-radius-${k}:${e.value}px;`);
}
emit(`  --dsh-dur:${T.geometry.tokens.transition.base.value};`);
emit(`  --dsh-dur-fast:${T.geometry.tokens.transition.fast.value};`);
emit(`  --dsh-dur-slow:${T.geometry.tokens.transition.slow.value};`);
emit(`  --dsh-ease:${T.geometry.tokens.transition.ease.value};`);
emit(`  --dsh-font:${T.geometry.tokens.font.textFamily.value};`);
emit(`  --dsh-font-code:${T.geometry.tokens.font.codeFamily.value};`);
emit(`  --dsh-content-size:${T.geometry.tokens.font.contentSize.value};`);
emit(`  --dsh-content-lh:${T.geometry.tokens.font.markdownBaseLineHeight.value}px;`);
emit(`  --dsh-code-size:${T.geometry.tokens.font.codeSize.value};`);
emit('}');
emit('');
emit('/* ── 顏色（DSH 深色 = [data-theme="dsh"]）── */');
const colorMap = [
  ['bg', 'bg-base'], ['bg-side', 'bg-base'], ['bg-elev', 'bg-layer-1'], ['sel', 'bg-layer-2'],
  ['line', 'border-l1'], ['line-strong', 'border-l3'],
  ['fg', 'label-primary'], ['fg2', 'label-secondary'], ['fg3', 'label-tertiary'],
  ['acc', 'state-business-primary'],
];
for (const theme of ['dark', 'light']) {
  const sel = theme === 'dark' ? ':root[data-theme="dsh"]' : ':root[data-theme="dsh-light"]';
  emit(`${sel}{`);
  for (const [mine, theirs] of colorMap) emit(`  --dsh-color-${mine}:${color(theme, theirs)};`);
  emit(`  --dsh-color-sidebar-fill:${spec(theme, 'sidebar-fill')};`);
  emit(`  --dsh-color-input:${spec(theme, 'input-major')};`);
  emit(`  --dsh-color-selector:${spec(theme, 'selector')};`);
  emit(`  --dsh-color-border-l2:${color(theme, 'border-l2')};`);
  emit(`  --dsh-color-border-l4:${color(theme, 'border-l4')};`);
  emit(`  --dsh-color-hover:${color(theme, 'interactive-bg-hover')};`);
  emit(`  --dsh-color-elevated:${color(theme, 'button-elevated-fill')};`);
  emit(`  --dsh-color-float-hover:${color(theme, 'button-floating-hover')};`);
  emit(`  --dsh-color-caption:${color(theme, 'label-caption')};`);
  emit(`  --dsh-color-dimmed:${color(theme, 'label-dimmed')};`);
  emit(`  --dsh-color-module:${color(theme, 'bg-module-platform')};`);
  emit(`  --dsh-color-overlay:${color(theme, 'bg-overlay')};`);
  emit('}');
  emit('');
}

if (missing.length) {
  console.error('❌ docs/DSH-真值.json 缺欄位，沒有產生 CSS：');
  for (const m of [...new Set(missing)]) console.error('   - ' + m);
  process.exit(1);
}

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log('✅ ui/dsh-tokens.css ·', lines.length, '行 · 來源 docs/DSH-真值.json');
