/**
 * Pulls plain headlines from public RSS feeds — no API key required.
 *
 * IMPORTANT: this returns raw headlines only (title, link, published time).
 * It does NOT explain *why* a price moved — that "market wire" narrative in
 * the original dashboard was written by hand after reading full articles.
 * Turning headlines into that kind of explanation automatically needs either
 * (a) a human editing pass, or (b) piping these headlines through an LLM
 * (e.g. the Claude API) to summarize. That's a natural next step if you want
 * it — this file just gives you clean raw material to work with.
 *
 * RSS feed URLs occasionally move. Both feeds below are commonly documented
 * public finance feeds, but verify them after cloning (open the URL in a
 * browser — you should see XML). Swap in any other feed URL as needed.
 */

const FEEDS = {
  marketwatch_top: 'http://feeds.marketwatch.com/marketwatch/topstories/',
  investing_commodities: 'https://www.investing.com/rss/commodities.rss'
};

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function fetchFeed(url, limit = 6) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BullionBourseBot/1.0)' }
  });
  if (!res.ok) throw new Error(`Feed request failed: HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit);
  return items.map(([, block]) => ({
    title: extractTag(block, 'title'),
    link: extractTag(block, 'link'),
    pubDate: extractTag(block, 'pubDate')
  }));
}

async function getHeadlines() {
  const entries = await Promise.all(
    Object.entries(FEEDS).map(async ([key, url]) => {
      try {
        return [key, await fetchFeed(url)];
      } catch (err) {
        return [key, { error: err.message }];
      }
    })
  );
  return Object.fromEntries(entries);
}

module.exports = { getHeadlines, FEEDS };
