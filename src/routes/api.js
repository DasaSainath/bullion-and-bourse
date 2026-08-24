const express = require('express');
const router = express.Router();

const { getQuotes, getAllReturns } = require('../providers/yahoo');
const { estimateIndiaGold, estimateIndiaSilver } = require('../providers/indiaMetals');
const { getHeadlines } = require('../providers/news');
const calendar = require('../../data/calendar.json');
const movers = require('../../data/movers.json');

// Tiny in-memory cache so a page full of widgets doesn't fire a fresh
// Yahoo request per widget, and so refreshing the page a lot doesn't
// hammer the upstream. Swap for Redis etc. if you ever run multiple instances.
const cache = new Map();
const TTL_MS = 60 * 1000;

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { data, ts: Date.now() });
  return data;
}

router.get('/quotes', async (req, res) => {
  try {
    const data = await cached('quotes', () => getQuotes());
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch quotes', detail: err.message });
  }
});

router.get('/returns', async (req, res) => {
  try {
    const names = ['gold', 'silver', 'sp500', 'sensex', 'nifty'];
    const data = await cached('returns', () => getAllReturns(names));
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch returns', detail: err.message });
  }
});

router.get('/india-metals', async (req, res) => {
  try {
    const dutyPct = Number(req.query.duty ?? 10);
    const gstPct = Number(req.query.gst ?? 3);

    const quotes = await cached('quotes', () => getQuotes());
    if (quotes.gold?.error || quotes.silver?.error || quotes.usdinr?.error) {
      throw new Error('Upstream quote missing for gold, silver, or usdinr');
    }

    const gold = estimateIndiaGold({
      spotUsdPerOz: quotes.gold.price,
      usdInr: quotes.usdinr.price,
      importDutyPct: dutyPct,
      gstPct
    });
    const silver = estimateIndiaSilver({
      spotUsdPerOz: quotes.silver.price,
      usdInr: quotes.usdinr.price,
      importDutyPct: dutyPct,
      gstPct
    });

    res.json({ gold, silver, usdInr: quotes.usdinr.price, assumptions: { dutyPct, gstPct } });
  } catch (err) {
    res.status(502).json({ error: 'Failed to compute India metals', detail: err.message });
  }
});

router.get('/news', async (req, res) => {
  try {
    const data = await cached('news', () => getHeadlines());
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch news', detail: err.message });
  }
});

router.get('/calendar', (req, res) => res.json(calendar));
router.get('/movers', (req, res) => res.json(movers));

module.exports = router;
