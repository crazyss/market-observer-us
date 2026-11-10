# 美股观察台 · Market Observer

一个轻量的美股与 ETF 行情观察平台。项目使用原生 HTML、CSS、JavaScript 和 SVG，直接部署静态文件即可。

- **在线行情**是默认首页，通过 TradingView 官方组件显示实际报价和图表。覆盖范围与延迟以组件和交易所标识为准。日线工作台的统计和 CSV 导出使用你导入的数据或标注的演示数据。
- **日线工作台**提供 4 只基准 ETF、8 只美股的合成日线示例。支持收盘价走势、K 线、成交量、区间统计和明细。区间按钮分别取最近 21、63、126、252 条日线。数据不足时显示现有记录。
- **自选和 CSV**支持按代码或名称搜索、收藏证券、导入每只证券的日线和导出当前区间。自选和导入数据保存在当前浏览器。

## 本地运行

需要 Node.js 18 或更新版本。无需安装依赖。

~~~sh
git clone https://github.com/crazyss/market-observer-us.git
cd market-observer-us
node serve.mjs
~~~

打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。端口可通过 MARKET_OBSERVER_PORT 环境变量设置。

静态部署只需发布 index.html、style.css、mark.svg 和四个 JavaScript 模块。也可在 GitHub Pages 中将 main 分支根目录作为发布源。

## CSV 格式

一次导入一只证券。在导入弹窗中填写代码并选择 UTF-8 文件。价格单位为美元，成交量单位为股。下面两行是合成示例。

~~~csv
date,open,high,low,close,volume
2026-10-29,211.00,215.50,210.75,214.60,43200000
2026-10-30,214.80,217.25,213.90,216.85,45100000
~~~

每个文件至少 2 条记录、至多 2 MB，同一交易日只允许一条记录。导入会按日期排序。导入同一证券代码会替换该证券的本地文件。日涨跌按相邻收盘价计算。数据复权口径以源文件为准。

## 代码与数据

- app.js 负责界面、导航和浏览器存储。
- chart.js 负责 SVG 图表和数据点交互。
- data.js 负责演示日线、CSV 校验和收益计算。
- market.js 集成 [TradingView Widgets](https://www.tradingview.com/widget-docs/)。

源码采用 MIT 许可证。TradingView 组件与行情受其各自条款约束。

