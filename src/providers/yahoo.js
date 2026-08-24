/**
 * Yahoo Finance "chart" endpoint is an UNOFFICIAL, undocumented public API.
 * It requires no key and works for most tickers, but Yahoo can rate-limit,
 * change response shape, or block server IPs without notice. If this stops
 * working, the fix is either (a) add a short retry/backoff, or (b) swap this
 * file for a paid provider (Alpha Vantage, Twelve Data, Finnhub, GoldAPI.io)
 * — every route in src/routes/api.js only depends on the shape returned by
 * getQuotes()/getReturns() below, so swapping the source is a one-file change.
 */

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Friendly name -> Yahoo ticker
const SYMBOLS = {
  gold: 'GC=F',
  silver: 'SI=F',
  sp500: '^GSPC',
  dow: '^DJI',
  nasdaq: '^IXIC',
  russell2000: '^RUT',
  vix: '^VIX',
  sensex: '^BSESN',
  nifty: '^NSEI',
  usdinr: 'INR=X',
  crude: 'CL=F',
  dxy: 'DX-Y.NYB',
  yield10y: '^TNX',
  bitcoin: 'BTC-USD'
};

async function fetchChart(symbol, { range = '1d', interval = '1m' } = {}) {
  const url = `${BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    headers: {
      // Yahoo's endpoint is far more reliable with a normal browser UA.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`Yahoo chart request failed for ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const reason = json?.chart?.error?.description || 'no result in response';
    throw new Error(`Yahoo chart returned no data for ${symbol}: ${reason}`);
  }
  return result;
}

/** One quote: current price, previous close, absolute + percent change. */
async function getQuote(name) {
  const symbol = SYMBOLS[name];
  if (!symbol) throw new Error(`Unknown symbol name: ${name}`);
  const result = await fetchChart(symbol, { range: '1d', interval: '1m' });
  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : null;
  return {
    name,
    symbol,
    price,
    previousClose: prevClose,
    change,
    changePercent,
    currency: meta.currency,
    marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : null
  };
}

/** Many quotes at once. Failures are isolated per-symbol so one bad ticker doesn't sink the rest. */
async function getQuotes(names = Object.keys(SYMBOLS)) {
  const entries = await Promise.all(
    names.map(async (name) => {
      try {
        return [name, await getQuote(name)];
      } catch (err) {
        return [name, { name, error: err.message }];
      }
    })
  );
  return Object.fromEntries(entries);
}

/** 1D / 1W / 1M / 1Y % return for one symbol, computed from daily closes over the past year. */
async function getReturns(name) {
  const symbol = SYMBOLS[name];
  if (!symbol) throw new Error(`Unknown symbol name: ${name}`);
  const result = await fetchChart(symbol, { range: '1y', interval: '1d' });
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const clean = closes.filter((c) => typeof c === 'number');
  if (clean.length < 2) throw new Error(`Not enough history to compute returns for ${name}`);

  const latest = clean[clean.length - 1];
  const pctFrom = (tradingDaysAgo) => {
    const idx = clean.length - 1 - tradingDaysAgo;
    if (idx < 0) return null;
    const base = clean[idx];
    if (!base) return null;
    return ((latest - base) / base) * 100;
  };

  return {
    name,
    symbol,
    latest,
    oneDay: pctFrom(1),
    oneWeek: pctFrom(5), // ~5 trading days
    oneMonth: pctFrom(21), // ~21 trading days
    oneYear: pctFrom(clean.length - 1)
  };
}

async function getAllReturns(names) {
  const entries = await Promise.all(
    names.map(async (name) => {
      try {
        return [name, await getReturns(name)];
      } catch (err) {
        return [name, { name, error: err.message }];
      }
    })
  );
  return Object.fromEntries(entries);
}

module.exports = { SYMBOLS, getQuote, getQuotes, getReturns, getAllReturns };
