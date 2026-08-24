/**
 * One-line "why did it move" explanation for gold & silver.
 *
 * Two modes, same output shape either way:
 *  - AI mode (ANTHROPIC_API_KEY set): asks Claude to read today's price
 *    direction plus the live headlines already pulled in src/providers/news.js
 *    and write one grounded sentence per metal.
 *  - Heuristic mode (no key, the default): scans those same headlines for the
 *    first one mentioning gold/silver; falls back to a dollar-index/yield
 *    read; falls back again to an honest "no clear driver today" line. Always
 *    returns something, no key required.
 *
 * Either way this is a best-effort read of public headlines and price moves,
 * not verified financial analysis or investment advice.
 */

let Anthropic = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!Anthropic) Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic();
}

function flattenHeadlines(news) {
  return Object.values(news || {})
    .flatMap((arr) => (Array.isArray(arr) ? arr : []))
    .map((h) => h.title)
    .filter(Boolean);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function directionWord(changePercent) {
  if (changePercent === null || changePercent === undefined || Number.isNaN(changePercent)) return 'is flat';
  if (changePercent > 0.05) return 'is up';
  if (changePercent < -0.05) return 'is down';
  return 'is flat';
}

function heuristicOne(metal, changePercent, headlines, quotes) {
  const dir = directionWord(changePercent);
  const re = new RegExp(metal, 'i');
  const hit = headlines.find((h) => re.test(h));
  if (hit) return `${cap(metal)} ${dir} today — top related headline: "${hit}".`;

  const dxy = quotes?.dxy?.changePercent;
  const yield10y = quotes?.yield10y?.changePercent;
  if (typeof dxy === 'number' && Math.abs(dxy) > 0.15) {
    return `${cap(metal)} ${dir} today, alongside the dollar index ${dxy > 0 ? 'strengthening' : 'weakening'} (${dxy > 0 ? '+' : ''}${dxy.toFixed(2)}%) — no metal-specific headline came through the wire yet.`;
  }
  if (typeof yield10y === 'number' && Math.abs(yield10y) > 0.15) {
    return `${cap(metal)} ${dir} today as the 10-year yield moved ${yield10y > 0 ? 'up' : 'down'} (${yield10y > 0 ? '+' : ''}${yield10y.toFixed(2)}%) — no metal-specific headline came through the wire yet.`;
  }
  return `${cap(metal)} ${dir} today — no single clear driver in today's headlines; check Market Wire above for the fuller picture.`;
}

async function aiAnalysis({ goldPct, silverPct, headlines }) {
  const client = getClient();
  const prompt = `Gold ${directionWord(goldPct)} ${goldPct === null || goldPct === undefined ? 'an unknown amount' : goldPct.toFixed(2) + '%'} today. Silver ${directionWord(silverPct)} ${silverPct === null || silverPct === undefined ? 'an unknown amount' : silverPct.toFixed(2) + '%'} today.

Today's raw market headlines (may or may not be relevant):
${headlines.slice(0, 15).map((h) => `- ${h}`).join('\n') || '(none available)'}

Write exactly two lines, no preamble, no markdown:
GOLD: <one sentence, at most 25 words, plain language, grounded only in the headlines above or general macro reasoning (dollar, yields, safe-haven demand, central bank buying). If nothing available explains it, say so honestly instead of guessing.>
SILVER: <same, one sentence>`;

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 300,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content.find((b) => b.type === 'text')?.text || '';
  const goldMatch = text.match(/GOLD:\s*(.+)/i);
  const silverMatch = text.match(/SILVER:\s*(.+)/i);
  return {
    gold: goldMatch ? goldMatch[1].trim() : null,
    silver: silverMatch ? silverMatch[1].trim() : null
  };
}

async function getMetalAnalysis({ quotes, news }) {
  const headlines = flattenHeadlines(news);
  const goldPct = quotes?.gold?.changePercent;
  const silverPct = quotes?.silver?.changePercent;

  const client = getClient();
  if (client) {
    try {
      const ai = await aiAnalysis({ goldPct, silverPct, headlines });
      return {
        gold: { text: ai.gold || heuristicOne('gold', goldPct, headlines, quotes), source: ai.gold ? 'ai' : 'heuristic' },
        silver: { text: ai.silver || heuristicOne('silver', silverPct, headlines, quotes), source: ai.silver ? 'ai' : 'heuristic' }
      };
    } catch (err) {
      // Any API failure (no credits, rate limit, network) — fall through to heuristic below.
    }
  }

  return {
    gold: { text: heuristicOne('gold', goldPct, headlines, quotes), source: 'heuristic' },
    silver: { text: heuristicOne('silver', silverPct, headlines, quotes), source: 'heuristic' }
  };
}

module.exports = { getMetalAnalysis };
