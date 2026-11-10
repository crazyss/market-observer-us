function embed(host, name, config, link, onStatus) {
  const container = document.createElement('div');
  container.className = 'tradingview-widget-container';
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  const copyright = document.createElement('div');
  copyright.className = 'tradingview-widget-copyright';
  const attribution = document.createElement('a');
  attribution.href = link;
  attribution.textContent = '行情由 TradingView 提供';
  attribution.target = '_blank';
  attribution.rel = 'noopener nofollow';
  copyright.append(attribution);

  const script = document.createElement('script');
  script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
  script.async = true;
  script.textContent = JSON.stringify(config);
  if (onStatus) {
    const observer = new MutationObserver(() => {
      const frame = container.querySelector('iframe');
      if (!frame) return;
      observer.disconnect();
      frame.title = 'TradingView 在线行情图表';
      clearTimeout(timer);
      if (container.isConnected) onStatus('行情时效以 TradingView 图表标示为准');
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      if (container.isConnected) onStatus('加载超时。可重载组件或打开 TradingView。');
    }, 12000);
    observer.observe(container, { childList: true, subtree: true });
    script.onerror = () => {
      observer.disconnect();
      clearTimeout(timer);
      if (container.isConnected) onStatus('行情组件加载失败。可重载组件或打开 TradingView。');
    };
  }
  container.append(widget, copyright, script);
  host.replaceChildren(container);
}

export function mountMarket(securities, benchmarks, watch, selected) {
  const tape = document.getElementById('tape');
  const shortcuts = document.getElementById('online-shortcuts');
  const host = document.getElementById('online-chart');
  const status = document.getElementById('online-status');
  const external = document.getElementById('external-symbol');
  const initial = Object.hasOwn(securities, selected) ? selected : 'AAPL';
  let symbol = initial;

  function loadChart(next) {
    symbol = next;
    const code = securities[symbol][2];
    external.href = 'https://www.tradingview.com/symbols/' + code.replace(':', '-') + '/';
    shortcuts.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', button.textContent === symbol));
    status.textContent = '正在请求行情组件…';
    embed(host, 'advanced-chart', {
      symbol: code,
      autosize: true,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'zh_CN',
      withdateranges: true,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      support_host: 'https://www.tradingview.com'
    }, external.href, message => { status.textContent = message; });
  }

  function loadTape() {
    embed(tape, 'ticker-tape', {
      symbols: [...benchmarks, 'AAPL', 'NVDA', 'MSFT'].map(ticker => ({ proName: securities[ticker][2], title: ticker })),
      colorTheme: 'dark',
      isTransparent: false,
      displayMode: 'adaptive',
      showSymbolLogo: true,
      locale: 'zh_CN'
    }, 'https://www.tradingview.com/markets/stocks-usa/');
  }

  const displayed = new Set([...benchmarks, ...watch.filter(ticker => Object.hasOwn(securities, ticker)), initial]);
  shortcuts.replaceChildren(...Array.from(displayed, ticker => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button code';
    button.textContent = ticker;
    button.addEventListener('click', () => loadChart(ticker));
    return button;
  }));
  document.getElementById('reload-market').onclick = () => { loadTape(); loadChart(symbol); };
  loadTape();
  loadChart(initial);
}
