import { benchmarks, dailyDelta, demo, demoEnd, defaultWatch, parseDailyCsv, securities, serializeDailyCsv, validSymbol } from './data.js';
import { drawChart, sparkline } from './chart.js';
import { mountMarket } from './market.js';

const $ = id => document.getElementById(id);
const icons = {
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M5 15v4h14v-4"/>',
  download: '<path d="M12 4v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  line: '<path d="M3 17l6-6 4 3 7-8M3 21h18"/>',
  candles: '<path d="M6 3v4m0 7v4m6-8v4m0 6v2m6-20v3m0 8v6"/><path d="M4 7h4v7H4zm6 7h4v6h-4zm6-9h4v8h-4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem('market-observer:' + key)) ?? fallback; }
  catch { return fallback; }
}
function writeLocal(key, value) {
  try { localStorage.setItem('market-observer:' + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const storedImports = readLocal('daily', {});
let imported = Object.assign(Object.create(null), storedImports);
const savedWatch = readLocal('watch', defaultWatch);
let watch = Array.isArray(savedWatch) ? savedWatch.filter(validSymbol) : defaultWatch;
let source = readLocal('source', 'demo') === 'csv' && Object.keys(imported).length ? 'csv' : 'demo';
let selected = readLocal('selected', 'AAPL');
let range = 63;
let style = 'line';
let expanded = false;
let visibleRows = [];
let toastTimer;
let onlineMounted = false;

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exactVolume = new Intl.NumberFormat('en-US');
const compactVolume = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const price = value => money.format(value);
const tone = value => value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
const percent = value => value === null ? '—' : (value > 0 ? '+' : '') + (value * 100).toFixed(2) + '%';
const priceChange = value => (value > 0 ? '+' : value < 0 ? '−' : '') + price(Math.abs(value));
const activeSeries = () => source === 'csv' ? imported : demo;
const hasSeries = (series, symbol) => Object.hasOwn(series, symbol);
const label = symbol => securities[symbol]?.[0] ?? '导入证券';
const symbolMark = symbol => `<span class="symbol-mark" data-tone="${symbol.charCodeAt(0) % 4}" aria-hidden="true">${symbol[0]}</span>`;

function starButton(symbol) {
  const pinned = watch.includes(symbol);
  return `<button class="button square star${pinned ? ' selected' : ''}" type="button" data-star="${symbol}" aria-pressed="${pinned}" aria-label="${pinned ? '移除' : '添加'} ${symbol} 自选" title="${pinned ? '移除自选' : '添加自选'}">${icon('star')}</button>`;
}

function ensureSelection() {
  if (!hasSeries(activeSeries(), selected)) selected = Object.keys(activeSeries())[0];
}

function setSource(value, symbol) {
  if (value === 'csv' && !Object.keys(imported).length) {
    $('source-dialog').close();
    openImport();
    return;
  }
  source = value;
  selected = symbol ?? selected;
  ensureSelection();
  writeLocal('source', source);
  writeLocal('selected', selected);
  expanded = false;
  showView('overview');
  render();
}

function selectSymbol(symbol) {
  if (hasSeries(activeSeries(), symbol)) {
    selected = symbol;
    expanded = false;
    writeLocal('selected', selected);
    render();
  } else {
    setSource(hasSeries(imported, symbol) ? 'csv' : 'demo', symbol);
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

function toggleWatch(symbol) {
  watch = watch.includes(symbol) ? watch.filter(item => item !== symbol) : [...watch, symbol];
  const saved = writeLocal('watch', watch);
  render();
  renderSearch();
  if (!saved) showToast('浏览器存储不可用，自选仅在本次会话保留。');
}

function renderBenchmarks() {
  const symbols = source === 'demo' ? benchmarks : Object.keys(imported);
  $('benchmark-title').textContent = source === 'demo' ? '基准与风向标' : '已导入证券';
  $('benchmark-note').textContent = source === 'demo' ? 'ETF 代理 · 近 21 条日线' : '每只证券采用各自最近一条日线';
  $('benchmarks').innerHTML = symbols.map(symbol => {
    const rows = activeSeries()[symbol];
    const delta = dailyDelta(rows);
    return `<button class="benchmark ${symbol === selected ? 'active' : ''}" data-symbol="${symbol}" aria-pressed="${symbol === selected}">
      <span class="bench-name"><span class="code">${symbol}</span><small>${source === 'csv' ? rows.at(-1).date : label(symbol)}</small></span>
      <span class="bench-body"><span><span class="bench-price">${price(rows.at(-1).close)}</span><span class="bench-delta ${tone(delta)}">${percent(delta)}</span></span>${sparkline(rows.slice(-21), tone(delta))}</span>
    </button>`;
  }).join('');
}

function renderWatch() {
  const series = activeSeries();
  $('watch-count').textContent = watch.length;
  $('watch-list').innerHTML = watch.map(symbol => {
    const rows = hasSeries(series, symbol) ? series[symbol] : null;
    const delta = rows ? dailyDelta(rows) : null;
    return `<button class="watch-row ${symbol === selected ? 'active' : ''}" data-symbol="${symbol}" aria-pressed="${symbol === selected}">
      ${symbolMark(symbol)}<span class="watch-identity"><span class="code">${symbol}</span><small>${label(symbol)}</small></span>
      <span class="watch-value">${rows ? price(rows.at(-1).close) : '—'}<small class="${tone(delta)}">${rows ? percent(delta) : '当前源无数据'}</small></span>
    </button>`;
  }).join('') || '<p class="empty">暂无自选。点击右上方的加号添加证券。</p>';
}

function renderChart() {
  drawChart($('chart'), $('chart-tooltip'), visibleRows, style, { price, volume: compactVolume });
}

function renderRecords(allRows) {
  const shown = expanded ? visibleRows : visibleRows.slice(-6);
  const offset = allRows.length - shown.length;
  $('records-body').innerHTML = shown.map((row, index) => {
    const delta = dailyDelta(allRows, offset + index);
    return `<tr><td>${row.date}</td><td>${price(row.open)}</td><td>${price(row.high)}</td><td>${price(row.low)}</td><td>${price(row.close)}</td><td class="${tone(delta)}">${percent(delta)}</td><td>${exactVolume.format(row.volume)}</td></tr>`;
  }).reverse().join('');
  $('more-rows').hidden = visibleRows.length <= 6;
  $('more-rows').textContent = expanded ? '收起' : '显示全部区间记录';
  $('record-count').textContent = `显示 ${shown.length} / ${visibleRows.length} 条`;
}

function render() {
  ensureSelection();
  const rows = activeSeries()[selected];
  const last = rows.at(-1);
  const prev = rows.at(-2);
  const delta = dailyDelta(rows);
  const instrumentMeta = [label(selected), securities[selected]?.[1]].filter(Boolean).join(' · ');
  $('source-badge').innerHTML = source === 'demo' ? '<span></span> 演示数据' : '<span></span> 本地 CSV';
  $('source-badge').classList.toggle('csv', source === 'csv');
  $('market-date').textContent = source === 'demo' ? `示例截至 ${demoEnd}` : `当前证券截至 ${last.date}`;
  $('data-foot').textContent = source === 'demo' ? '合成日线 · USD · 示例日期按工作日生成' : '用户导入 · USD · 复权口径以 CSV 来源为准';
  $('instrument').innerHTML = `<div class="instrument-head"><div class="instrument-id">${symbolMark(selected)}<div><h2 id="symbol-heading">${selected}</h2><p>${instrumentMeta}</p></div></div>${starButton(selected)}</div>
    <div class="instrument-values"><span class="last-price">${price(last.close)}</span><span class="unit">USD</span><span class="delta ${tone(delta)}">${priceChange(last.close - prev.close)} (${percent(delta)})</span><span class="data-date">${last.date} 收盘</span></div>`;
  document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.range) === range));
  document.querySelectorAll('[data-style]').forEach(button => button.setAttribute('aria-pressed', button.dataset.style === style));
  renderBenchmarks();
  renderWatch();

  visibleRows = rows.slice(-range);
  const first = visibleRows[0];
  const stats = [
    ['区间涨跌', percent(last.close / first.close - 1), tone(last.close / first.close - 1)],
    ['区间最高', price(Math.max(...visibleRows.map(row => row.high))), ''],
    ['区间最低', price(Math.min(...visibleRows.map(row => row.low))), ''],
    ['平均日成交量', compactVolume.format(visibleRows.reduce((total, row) => total + row.volume, 0) / visibleRows.length), '']
  ];
  $('chart-stats').innerHTML = stats.map(([name, value, color]) => `<div><small>${name}</small><strong class="${color}">${value}</strong></div>`).join('');
  $('records-note').textContent = `${selected} · ${first.date} 至 ${last.date} · USD · ${source === 'demo' ? '演示' : '导入'}`;
  renderChart();
  renderRecords(rows);
}

function renderSearch() {
  const query = $('symbol-query').value.trim().toUpperCase();
  const symbols = [...new Set([...Object.keys(demo), ...Object.keys(imported)])];
  $('search-results').innerHTML = symbols.filter(symbol => symbol.includes(query) || label(symbol).toUpperCase().includes(query)).map(symbol => {
    const detail = hasSeries(imported, symbol) ? label(symbol) + ' · 可查看导入日线' : label(symbol) + ' · 演示数据';
    return `<div class="search-row">${symbolMark(symbol)}<button type="button" class="search-result" data-symbol="${symbol}"><span class="code">${symbol}</span><small>${detail}</small></button>${starButton(symbol)}</div>`;
  }).join('') || '<p class="empty">没有匹配的证券。可导入该代码的 CSV，或在在线图表中搜索。</p>';
}

function openSearch() {
  $('symbol-query').value = '';
  renderSearch();
  $('search-dialog').showModal();
  $('symbol-query').focus();
}

function openImport() {
  $('import-form').reset();
  $('import-error').hidden = true;
  $('import-dialog').showModal();
}

function download(name, body) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showView(view, updateUrl = true) {
  const online = view === 'live';
  $('overview').hidden = online;
  $('live').hidden = !online;
  $('search-open').hidden = online;
  $('nav-overview').toggleAttribute('aria-current', !online);
  $('nav-live').toggleAttribute('aria-current', online);
  (online ? $('nav-live') : $('nav-overview')).setAttribute('aria-current', 'page');
  if (updateUrl) history.replaceState(null, '', online ? '#live' : '#overview');
  if (online && !onlineMounted) {
    mountMarket(securities, benchmarks, watch, selected);
    onlineMounted = true;
  }
  if (!online && visibleRows.length) renderChart();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const { star, symbol, range: nextRange, style: nextStyle, view } = button.dataset;
  if (star) {
    const dialog = button.closest('dialog');
    toggleWatch(star);
    const scope = dialog ?? $('instrument');
    scope.querySelector(`[data-star="${star}"]`)?.focus();
  } else if (symbol) {
    $('search-dialog').close();
    selectSymbol(symbol);
    showView('overview');
    const scope = button.closest('#benchmarks, #watch-list');
    if (scope) scope.querySelector(`[data-symbol="${symbol}"]`)?.focus();
  } else if (nextRange) {
    range = Number(nextRange);
    expanded = false;
    render();
  } else if (nextStyle) {
    style = nextStyle;
    render();
  } else if (view) {
    showView(view);
  } else if (button.classList.contains('close-dialog')) {
    button.closest('dialog').close();
  }
});

$('search-open').addEventListener('click', openSearch);
$('watch-add').addEventListener('click', openSearch);
$('symbol-query').addEventListener('input', renderSearch);
$('import-open').addEventListener('click', openImport);
$('source-open').addEventListener('click', () => $('source-dialog').showModal());
$('switch-demo').addEventListener('click', () => { $('source-dialog').close(); setSource('demo'); });
$('switch-csv').addEventListener('click', () => { $('source-dialog').close(); setSource('csv'); });
$('more-rows').addEventListener('click', () => { expanded = !expanded; renderRecords(activeSeries()[selected]); });
$('export').addEventListener('click', () => download(`${selected}-${source}-${visibleRows[0].date}-${visibleRows.at(-1).date}.csv`, serializeDailyCsv(visibleRows)));
$('example').addEventListener('click', () => download('AAPL-demo-example.csv', serializeDailyCsv(demo.AAPL.slice(-12))));
$('import-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const error = $('import-error');
  error.hidden = true;
  try {
    const symbol = $('import-symbol').value.trim().toUpperCase();
    const file = $('import-file').files[0];
    if (!validSymbol(symbol)) throw new Error('请输入有效证券代码，例如 AAPL 或 BRK.B。');
    if (!file || file.size > 2000000) throw new Error('请选择 2 MB 以内的 CSV 文件。');
    const rows = parseDailyCsv(await file.text());
    imported = Object.assign(Object.create(null), imported, { [symbol]: rows });
    const saved = writeLocal('daily', imported);
    $('import-dialog').close();
    setSource('csv', symbol);
    showToast(`已导入 ${symbol} 的 ${rows.length} 条日线。${saved ? '' : ' 浏览器存储空间不足或不可用，数据仅在本次会话保留。'}`);
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('keydown', event => {
  if (!$('overview').hidden && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input, textarea, [contenteditable]') && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    openSearch();
  }
});
window.addEventListener('hashchange', () => showView(location.hash === '#overview' ? 'overview' : 'live', false));
new ResizeObserver(() => {
  if (!$('overview').hidden && visibleRows.length) renderChart();
}).observe($('chart-space'));

render();
showView(location.hash === '#overview' ? 'overview' : 'live', false);

$('source-badge').addEventListener('click', () => $('source-dialog').showModal());
