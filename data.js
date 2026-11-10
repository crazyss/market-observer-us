export const securities = {
  SPY: ['标普 500 ETF', 'NYSE Arca', 'AMEX:SPY', 613, .14, 73000000],
  QQQ: ['纳斯达克 100 ETF', 'Nasdaq', 'NASDAQ:QQQ', 512, .19, 47000000],
  DIA: ['道琼斯工业 ETF', 'NYSE Arca', 'AMEX:DIA', 419, .09, 3500000],
  IWM: ['罗素 2000 ETF', 'NYSE Arca', 'AMEX:IWM', 211, -.04, 31000000],
  AAPL: ['苹果', 'Nasdaq', 'NASDAQ:AAPL', 222, .20, 53000000],
  NVDA: ['英伟达', 'Nasdaq', 'NASDAQ:NVDA', 135, .36, 174000000],
  MSFT: ['微软', 'Nasdaq', 'NASDAQ:MSFT', 405, .12, 22000000],
  TSLA: ['特斯拉', 'Nasdaq', 'NASDAQ:TSLA', 272, -.15, 98000000],
  AMZN: ['亚马逊', 'Nasdaq', 'NASDAQ:AMZN', 187, .18, 37000000],
  META: ['Meta Platforms', 'Nasdaq', 'NASDAQ:META', 592, .15, 16000000],
  GOOGL: ['Alphabet A', 'Nasdaq', 'NASDAQ:GOOGL', 182, .14, 25000000],
  AMD: ['超威半导体', 'Nasdaq', 'NASDAQ:AMD', 143, -.13, 38000000]
};

export const benchmarks = ['SPY', 'QQQ', 'DIA', 'IWM'];
export const defaultWatch = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META'];
export const demoEnd = '2026-10-30';

function createDemoSeries([, , , base, drift, volume], seed) {
  let state = (seed + 11) * 16313;
  function next() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  }

  const dates = [];
  const day = new Date(demoEnd + 'T00:00:00Z');
  while (dates.length < 253) {
    if (day.getUTCDay() % 6) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() - 1);
  }

  let previous = base * .84;
  const cents = value => Math.round(value * 100) / 100;
  return dates.reverse().map((date, index) => {
    const open = cents(previous * (1 + (next() - .5) * .014));
    const wave = Math.sin(index / 13 + seed * .8) * .006;
    const close = cents(open * (1 + wave + (next() - .5) * .043 + drift * .009));
    const high = cents(Math.max(open, close) * (1 + next() * .017));
    const low = cents(Math.min(open, close) * (1 - next() * .018));
    previous = close;
    return { date, open, high, low, close, volume: Math.round(volume * (.52 + next() * 1.05)) };
  });
}

export const demo = Object.fromEntries(Object.entries(securities).map(([symbol, entry], seed) =>
  [symbol, createDemoSeries(entry, seed)]
));

export const fields = ['date', 'open', 'high', 'low', 'close', 'volume'];
export const validSymbol = value => /^[A-Z][A-Z0-9.-]{0,17}$/.test(value) && !['CONSTRUCTOR', 'PROTOTYPE'].includes(value);

function csvCells(line) {
  const cell = /\s*(?:"((?:[^"]|"")*)"|([^",]*?))\s*(,|$)/gy;
  const cells = [];
  do {
    const match = cell.exec(line);
    if (!match) throw new Error('CSV 引号或逗号格式有误。');
    cells.push((match[1]?.replaceAll('""', '"') ?? match[2]).trim());
    if (!match[3]) break;
  } while (true);
  return cells;
}

export function parseDailyCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r\n?|\n/).filter(line => line.trim());
  if (lines.length < 3) throw new Error('需要表头和至少 2 行日线数据。');
  const header = csvCells(lines[0]).map(value => value.toLowerCase());
  const columns = fields.map(field => header.indexOf(field));
  if (columns.some(index => index < 0) || new Set(header).size !== header.length) {
    throw new Error('CSV 必须包含 date、open、high、low、close、volume，列名不能重复。');
  }

  const dates = new Set();
  const rows = lines.slice(1).map((line, index) => {
    const cells = csvCells(line);
    if (cells.length !== header.length) throw new Error(`第 ${index + 1} 条记录的列数与表头不一致。`);
    const [date, ...numbers] = columns.map(column => cells[column]);
    const day = Date.parse(date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date || dates.has(date)) {
      throw new Error(`第 ${index + 1} 条记录的日期无效或重复。`);
    }
    const [open, high, low, close, volume] = numbers.map(Number);
    const validPrices = [open, high, low, close].every(value => Number.isFinite(value) && value > 0 && value <= 1000000000);
    if (numbers.some(value => !/^\d+(?:\.\d+)?$/.test(value)) || !validPrices || low > Math.min(open, close) ||
        high < Math.max(open, close) || !Number.isSafeInteger(volume) || volume < 0) {
      throw new Error(`第 ${index + 1} 条记录的 OHLC 或成交量无效。`);
    }
    dates.add(date);
    return { date, open, high, low, close, volume };
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function serializeDailyCsv(rows) {
  return [fields.join(','), ...rows.map(row => fields.map(field => row[field]).join(','))].join('\n') + '\n';
}

export function dailyDelta(rows, index = rows.length - 1) {
  if (index < 1) return null;
  return rows[index].close / rows[index - 1].close - 1;
}

