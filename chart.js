const cyan = '#53e6bc';
const red = '#fb8c9a';
const path = points => points.map(([x, y], index) => (index === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ');

export function sparkline(rows, tone) {
  const closes = rows.map(row => row.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const points = closes.map((close, index) => [2 + index / Math.max(1, closes.length - 1) * 88, 33 - (close - low) / (high - low || 1) * 28]);
  const line = path(points);
  return `<svg class="spark ${tone}" viewBox="0 0 92 38" aria-hidden="true"><path d="${line}L90 38H2Z" fill="currentColor" opacity=".08"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

export function drawChart(svg, tooltip, rows, style, formats) {
  const width = svg.clientWidth;
  if (width < 100 || !rows.length) return;
  const height = 258;
  const left = 12;
  const right = width - 65;
  const top = 15;
  const priceBottom = 174;
  const volumeTop = 193;
  const volumeBottom = 233;
  const step = (right - left) / rows.length;
  const candleWidth = Math.min(9, step * .68);
  const lo = Math.min(...rows.map(row => style === 'candle' ? row.low : row.close));
  const hi = Math.max(...rows.map(row => style === 'candle' ? row.high : row.close));
  const pad = (hi - lo || hi * .06) * .12;
  const min = lo - pad;
  const max = hi + pad;
  const maxVolume = Math.max(1, ...rows.map(row => row.volume));
  const x = index => left + (index + .5) * step;
  const y = value => priceBottom - (value - min) / (max - min) * (priceBottom - top);
  const closeLine = path(rows.map((row, index) => [x(index), y(row.close)]));
  const lines = Array.from({ length: 5 }, (_, index) => {
    const value = max - index * (max - min) / 4;
    return `<path d="M${left} ${y(value)}H${right}" stroke="#243448" stroke-dasharray="3 4"/><text x="${width - 2}" y="${y(value) + 3}" text-anchor="end">${formats.price(value)}</text>`;
  });
  const tickCount = Math.min(rows.length, width > 500 ? 6 : 3);
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.round(i * (rows.length - 1) / Math.max(1, tickCount - 1)));
  const dates = ticks.map((index, i) => {
    const edge = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle';
    return `<text x="${x(index)}" y="252" text-anchor="${edge}">${rows[index].date.slice(5)}</text>`;
  });
  const volumes = rows.map((row, index) => {
    const h = row.volume / maxVolume * (volumeBottom - volumeTop);
    const color = row.close >= row.open ? cyan : red;
    return `<rect x="${x(index) - candleWidth / 2}" y="${volumeBottom - h}" width="${candleWidth}" height="${h}" fill="${color}" opacity=".38"/>`;
  });
  const candles = rows.map((row, index) => {
    const color = row.close >= row.open ? cyan : red;
    return `<path d="M${x(index)} ${y(row.high)}V${y(row.low)}" stroke="${color}"/><rect x="${x(index) - candleWidth / 2}" y="${Math.min(y(row.open), y(row.close))}" width="${candleWidth}" height="${Math.max(1, Math.abs(y(row.open) - y(row.close)))}" fill="${color}"/>`;
  });
  const last = rows.at(-1);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-label', `${style === 'candle' ? 'K 线' : '收盘价'}与成交量图，共 ${rows.length} 条日线。用左右方向键查看数据点。`);
  svg.innerHTML = `<defs><linearGradient id="area" x2="0%" y2="100%"><stop stop-color="#44d8bb" stop-opacity=".21"/><stop offset="1" stop-color="#44d8bb" stop-opacity=".01"/></linearGradient></defs>
    ${lines.join('')}${style === 'candle' ? candles.join('') :
      `<path d="${closeLine}L${x(rows.length - 1)} ${priceBottom}H${x(0)}Z" fill="url(#area)"/><path d="${closeLine}" fill="none" stroke="${cyan}" stroke-width="1.75" stroke-linejoin="round"/><circle cx="${x(rows.length - 1)}" cy="${y(last.close)}" r="3.3" fill="${cyan}"/>`}
    <path d="M${left} ${volumeBottom}H${right}" stroke="#2b3e54"/>${volumes.join('')}
    <text x="${width - 2}" y="${volumeTop + 7}" text-anchor="end">VOL</text>${dates.join('')}
    <g data-crosshair hidden><line class="crosshair" y1="${top}" y2="${volumeBottom}"/><circle r="3" fill="${cyan}"/></g>`;
  const crosshair = svg.querySelector('[data-crosshair]');
  let focusIndex = -1;
  function hide() {
    crosshair.setAttribute('hidden', '');
    tooltip.hidden = true;
  }
  function inspect(index) {
    focusIndex = Math.max(0, Math.min(rows.length - 1, index));
    const row = rows[focusIndex];
    const point = x(focusIndex);
    crosshair.setAttribute('transform', `translate(${point} 0)`);
    crosshair.lastElementChild.setAttribute('cy', y(row.close));
    crosshair.removeAttribute('hidden');
    tooltip.innerHTML = `${row.date} · USD<br><span>开</span> ${formats.price(row.open)}　<span>高</span> ${formats.price(row.high)}<br><span>低</span> ${formats.price(row.low)}　<span>收</span> ${formats.price(row.close)}<br><span>量</span> ${formats.volume.format(row.volume)}`;
    tooltip.hidden = false;
    tooltip.style.left = Math.max(0, point + tooltip.offsetWidth + 12 > width ? point - tooltip.offsetWidth - 10 : point + 10) + 'px';
  }
  svg.onpointermove = event => inspect(Math.floor((event.clientX - svg.getBoundingClientRect().left - left) / step));
  svg.onpointerleave = hide;
  svg.onblur = hide;
  svg.onkeydown = event => {
    if (event.key === 'Escape') { hide(); return; }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    inspect(focusIndex < 0 ? rows.length - 1 : focusIndex + (event.key === 'ArrowRight' ? 1 : -1));
  };
  hide();
}

