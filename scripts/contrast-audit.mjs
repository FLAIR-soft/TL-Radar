#!/usr/bin/env node
// Контраст-аудит палитры по WCAG 2.1. Запуск: node scripts/contrast-audit.mjs
//
// Проверяет не «все токены против всех», а те пары, которые действительно
// встречаются на экране: текст на своей поверхности, текст на заливке кнопки,
// текст пилюли на её же подложке (с учётом color-mix из globals.css), рамка
// контрола на фоне поля. Пара, которой нет в интерфейсе, ничего не доказывает.
//
// Пороги: текст — 4.5:1 (AA), границы контролов и значимая графика — 3:1
// (WCAG 1.4.11). Выход 1, если хоть одна пара не проходит.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const hex = (h) => {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
/** Эмуляция color-mix(in srgb, A p%, B) из globals.css. */
const mix = (a, b, pa) => {
  const [A, B] = [hex(a), hex(b)];
  return '#' + [0, 1, 2].map((i) => Math.round(A[i] * pa + B[i] * (1 - pa)).toString(16).padStart(2, '0')).join('');
};

function tokens(selector) {
  const i = css.indexOf(selector);
  const open = css.indexOf('{', i);
  let depth = 1, j = open + 1;
  while (depth > 0) {
    if (css[j] === '{') depth++;
    if (css[j] === '}') depth--;
    j++;
  }
  const map = {};
  for (const m of css.slice(open + 1, j - 1).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) map['--' + m[1]] = m[2].trim();
  return map;
}

const light = tokens(':root {');
const dark = { ...light, ...tokens('[data-theme="dark"]') };

/** Пары для темы. v(x) — значение токена либо сам цвет. */
function pairs(T, isDark) {
  const v = (x) => (x.startsWith('#') ? x : T[x]);
  // Текст пилюли: в светлой теме globals.css затемняет его на 30%,
  // подложка — 16% цвета на поверхности карточки.
  const pillText = (c) => (isDark ? v(c) : mix(v(c), '#000000', 0.7));
  const pillBg = (c) => mix(v(c), v('--surface'), 0.16);
  const out = [
    ['основной текст на фоне', v('--ink'), v('--bg'), 4.5],
    ['основной текст на карточке', v('--ink'), v('--surface'), 4.5],
    ['подписи на карточке', v('--ink-muted'), v('--surface'), 4.5],
    ['подписи на фоне', v('--ink-muted'), v('--bg'), 4.5],
    ['второй текст', v('--ink-soft'), v('--surface'), 4.5],
    ['мелкие подписи (text-3)', v('--text-3'), v('--surface'), 4.5],
    ['иконки и слабые метки (text-4)', v('--text-4'), v('--surface'), 3],
    ['ссылка и бренд-текст', v('--brand-ink'), v('--surface'), 4.5],
    ['текст на красной заливке', v('--on-brand'), v('--brand-solid'), 4.5],
    ['красная заливка на фоне', v('--brand-solid'), v('--surface'), 3],
    ['текст на зелёной заливке', v('--on-done'), v('--done-solid'), 4.5],
    ['зелёная заливка на фоне', v('--done-solid'), v('--surface'), 3],
    ['рамка поля и вторичной кнопки', v('--control-border'), v('--surface'), 3],
  ];
  for (const [label, token] of [
    ['ожидает', '--waiting'],
    ['в работе', '--progress'],
    ['пауза', '--paused'],
    ['готово', '--done'],
    ['приоритет низкий', '--priority-low'],
    ['приоритет средний', '--priority-medium'],
    ['приоритет высокий', '--priority-high'],
    ['приоритет срочный', '--priority-urgent'],
  ]) {
    out.push([`пилюля «${label}»`, pillText(token), pillBg(token), 4.5]);
  }
  // Полоса приоритета слева на карточке — единственный графический признак,
  // поэтому для неё действует порог значимой графики, 3:1.
  for (const [label, token] of [
    ['низкий', '--priority-low'],
    ['средний', '--priority-medium'],
    ['высокий', '--priority-high'],
    ['срочный', '--priority-urgent'],
  ]) {
    out.push([`полоса приоритета «${label}»`, v(token), v('--surface'), 3]);
  }
  return out;
}

let failed = 0;
for (const [name, T, isDark] of [['СВЕТЛАЯ', light, false], ['ТЁМНАЯ', dark, true]]) {
  console.log('\n=== ' + name + ' ===');
  for (const [label, fg, bg, need] of pairs(T, isDark)) {
    if (!fg || !bg || !fg.startsWith('#') || !bg.startsWith('#')) {
      console.log(`  ??  ${label.padEnd(32)} не цвет: ${fg} / ${bg}`);
      failed++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= need;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok ' : 'НЕТ'} ${label.padEnd(32)} ${r.toFixed(2)}:1 (нужно ${need})  ${fg} на ${bg}`);
  }
}
console.log(failed ? `\nне проходят: ${failed}` : '\nвсе пары проходят');
process.exit(failed ? 1 : 0);
