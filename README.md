# Bullion & Bourse

A live gold, silver & markets dashboard — US vs. India — built as a small
Node/Express backend that serves a static frontend from the same process.
One deployable service, no build step, no required API keys.

This started as a one-off snapshot page and was rebuilt here into a proper
app so you can run it, push it to your own GitHub repo, deploy it, and keep
editing it.

## What's real vs. what's approximate

Worth knowing before you rely on this for anything:

| Data | Source | Live? |
|---|---|---|
| Gold, silver, S&P 500, Dow, Nasdaq, Sensex, Nifty, USD/INR, crude, DXY, 10Y yield, BTC | Yahoo Finance's public chart endpoint (unofficial, no key) | ✅ Live |
| 1D/1W/1M/1Y trend returns | Computed from 1 year of daily closes, same endpoint | ✅ Live |
| India gold/silver retail price | **Computed**: global spot × USD/INR + import duty + GST | ⚠️ Estimate, not a jeweller feed |
| Market Wire headlines | MarketWatch & Investing.com RSS | ✅ Live, but raw — no "why it moved" analysis |
| Session gainers/laggards | `data/movers.json` | ✏️ Manual — no free source for this |
| Upcoming catalysts calendar | `data/calendar.json` | ✏️ Manual — update as dates pass |
| Fed policy stance | — | ✏️ Not fetchable; read the wire instead |

Yahoo's chart endpoint is **unofficial and undocumented**. It's what most
hobby finance dashboards use because it needs no signup, but it can rate-limit
you, change shape, or block a server IP without warning. If it stops working,
`src/providers/yahoo.js` is the one file to fix or swap — everything downstream
only depends on the shape of `getQuotes()` / `getReturns()`, not on Yahoo
specifically. Good keyed replacements: [Twelve Data](https://twelvedata.com),
[Alpha Vantage](https://www.alphavantage.co), [GoldAPI.io](https://www.goldapi.io)
for metals specifically.

## Run it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Open **http://localhost:3000**. The page fetches everything client-side from
`/api/*` on load and again every 2 minutes.

`npm run dev` uses Node's built-in `--watch` flag to restart on file changes.

## Project layout

```
server.js                    Express app: static frontend + /api routes
src/providers/yahoo.js       Live quotes & historical returns (Yahoo chart endpoint)
src/providers/indiaMetals.js India gold/silver estimate (spot × fx + duty + GST)
src/providers/news.js        RSS headline fetcher (no API key)
src/routes/api.js            Wires the above into JSON endpoints + 60s cache
data/calendar.json           Upcoming events — edit by hand
data/movers.json             Session gainers/laggards — edit by hand
public/index.html            Page skeleton
public/styles.css            All styling
public/app.js                Fetches /api/* and renders every section
```

### API endpoints

| Route | Returns |
|---|---|
| `GET /api/quotes` | All live prices, keyed by name (`gold`, `silver`, `sp500`, …) |
| `GET /api/returns` | 1D/1W/1M/1Y % returns for gold, silver, sp500, sensex, nifty |
| `GET /api/india-metals` | Estimated India gold/silver price. Query params `?duty=10&gst=3` override the defaults |
| `GET /api/news` | Raw RSS headlines, grouped by feed |
| `GET /api/calendar` | Contents of `data/calendar.json` |
| `GET /api/movers` | Contents of `data/movers.json` |

## Deploying ("going live")

This is a single Node service — no separate frontend host needed. Any of
these free tiers work well for a personal project:

**Render.com** (simplest)
1. Push this repo to GitHub (steps below).
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Deploy. Render gives you a public URL automatically.

**Railway.app** — similar flow: New Project → Deploy from GitHub → it
auto-detects Node and runs `npm start`.

**Fly.io** — `fly launch` in this folder, accept the Node defaults, `fly deploy`.

None of these require an API key with the current setup. If you later add a
keyed provider (see the table above), set it as an environment variable in
that platform's dashboard rather than committing it to the repo.

## Getting this into your own Git repo

From inside this folder:

```bash
git init
git add .
git commit -m "Initial commit — Bullion & Bourse dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

(Create the empty repo on GitHub first — github.com → New repository — then
copy the URL it gives you into the `git remote add` line above.)

From then on, your normal workflow: edit files, then
```bash
git add .
git commit -m "describe the change"
git push
```
If you deployed via Render/Railway with GitHub auto-deploy enabled, every
push redeploys automatically.

## Extending it

- **Add a real news "why" layer**: `src/providers/news.js` returns clean raw
  headlines on purpose. Piping those through an LLM call (e.g. the Claude
  API) to generate the kind of "this is why gold moved" commentary from the
  original snapshot is a natural next step — add a new route that sends the
  headlines + price moves to a model and returns the summary.
- **Live gainers/laggards**: wire a free-tier screener (Finnhub, Alpha
  Vantage) into `src/routes/api.js` in place of `data/movers.json`.
- **City-level India premiums**: the original snapshot showed a Delhi vs.
  South-India silver premium. That's not in any free feed either — you'd need
  to scrape or manually track it, same pattern as `movers.json`.

## License

MIT — do whatever you want with it.
