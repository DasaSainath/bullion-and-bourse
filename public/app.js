// ---------- small formatting helpers ----------

function fmtNum(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, ...opts });
}

function fmtInr(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function fmtPct(n, { withSign = true } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return { text: '—', dir: 'flat' };
  const dir = n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲ ' : dir === 'down' ? '▼ ' : '';
  const sign = withSign && n > 0 ? '+' : '';
  return { text: `${arrow}${sign}${n.toFixed(2)}%`, dir };
}

async function getJSON(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `Request failed: ${url}`);
  return body;
}

// ---------- render: masthead ----------

function renderMasthead() {
  const el = document.getElementById('todayDate');
  el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ---------- render: ticker tape ----------

function renderTape(quotes) {
  const order = ['gold', 'silver', 'sp500', 'dow', 'nasdaq', 'sensex', 'nifty', 'usdinr', 'crude', 'yield10y', 'bitcoin'];
  const labels = {
    gold: 'GOLD', silver: 'SILVER', sp500: 'S&P 500', dow: 'DOW', nasdaq: 'NASDAQ',
    sensex: 'SENSEX', nifty: 'NIFTY 50', usdinr: 'USD/INR', crude: 'CRUDE OIL',
    yield10y: '10Y YIELD', bitcoin: 'BITCOIN'
  };

  const items = order
    .map((key) => {
      const q = quotes[key];
      if (!q || q.error) return null;
      const pct = fmtPct(q.changePercent);
      const price = key === 'usdinr' ? `₹${fmtNum(q.price, { maximumFractionDigits: 2 })}` : `$${fmtNum(q.price)}`;
      return `<span class="tape-item"><b>${labels[key]}</b> ${price} <span class="${pct.dir}">${pct.text}</span></span>`;
    })
    .filter(Boolean);

  const html = items.join('') || '<span class="tape-item">Live tape unavailable right now</span>';
  document.getElementById('tapeTrack').innerHTML = html + html; // duplicate for seamless loop
}

// ---------- render: metals hero ----------

function renderMetalsHero(quotes, india) {
  const gold = quotes.gold;
  const silver = quotes.silver;

  if (gold && !gold.error) {
    document.getElementById('goldUsPrice').textContent = `$${fmtNum(gold.price)}`;
    const pct = fmtPct(gold.changePercent);
    const chg = document.getElementById('goldUsChg');
    chg.textContent = `${pct.text} on the day`;
    chg.className = `price-chg ${pct.dir}`;
  }
  if (silver && !silver.error) {
    document.getElementById('silverUsPrice').textContent = `$${fmtNum(silver.price)}`;
    const pct = fmtPct(silver.changePercent);
    const chg = document.getElementById('silverUsChg');
    chg.textContent = `${pct.text} on the day`;
    chg.className = `price-chg ${pct.dir}`;
  }
  if (gold && silver && !gold.error && !silver.error) {
    document.getElementById('gsRatio').textContent = fmtNum(gold.price / silver.price, { maximumFractionDigits: 1 });
  }

  if (india && !india.error) {
    document.getElementById('goldIn24k').textContent =
      `₹${fmtNum(india.gold.inrPerGram24k, { maximumFractionDigits: 0 })}/g · ${fmtInr(india.gold.inrPer10g24k)}/10g`;
    document.getElementById('goldIn22k').textContent =
      `₹${fmtNum(india.gold.inrPerGram22k, { maximumFractionDigits: 0 })}/g · ${fmtInr(india.gold.inrPer10g22k)}/10g`;
    document.getElementById('silverInKg').textContent = `${fmtInr(india.silver.inrPerKg)}/kg`;
  }
}

// ---------- render: trend check ----------

function scaleBar(pct, cap = 40) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const width = Math.min(100, (Math.abs(pct) / cap) * 100);
  return { width: width.toFixed(0), dir: pct >= 0 ? 'up' : 'down' };
}

function trendCell(pct) {
  const bar = scaleBar(pct);
  if (!bar) return `<div class="trend-cell"><div class="trend-val flat">—</div><div class="trend-bar-track"></div></div>`;
  const label = fmtPct(pct);
  return `<div class="trend-cell">
    <div class="trend-val ${label.dir}">${label.text}</div>
    <div class="trend-bar-track"><div class="trend-bar ${bar.dir}" style="width:${bar.width}%"></div></div>
  </div>`;
}

function renderTrend(returns) {
  const rows = [
    { key: 'gold', label: 'Gold', color: 'var(--gold)' },
    { key: 'silver', label: 'Silver', color: 'var(--silver)' },
    { key: 'sp500', label: 'S&P 500', color: 'var(--us)' },
    { key: 'sensex', label: 'Sensex', color: 'var(--india)' },
    { key: 'nifty', label: 'Nifty 50', color: 'var(--india)' }
  ];

  const html = rows
    .map(({ key, label, color }) => {
      const r = returns[key];
      if (!r || r.error) {
        return `<div class="trend-row"><div class="trend-asset"><span class="metal-swatch" style="background:${color}"></span>${label}</div>
          ${trendCell(null)}${trendCell(null)}${trendCell(null)}${trendCell(null)}</div>`;
      }
      return `<div class="trend-row"><div class="trend-asset"><span class="metal-swatch" style="background:${color}"></span>${label}</div>
        ${trendCell(r.oneDay)}${trendCell(r.oneWeek)}${trendCell(r.oneMonth)}${trendCell(r.oneYear)}</div>`;
    })
    .join('');

  document.getElementById('trendBody').innerHTML = html;
}

// ---------- render: macro drivers ----------

function renderDrivers(quotes) {
  const dxy = quotes.dxy;
  const yield10y = quotes.yield10y;

  if (dxy && !dxy.error) {
    document.getElementById('dxyValue').textContent = fmtNum(dxy.price, { maximumFractionDigits: 2 });
    const pct = fmtPct(dxy.changePercent);
    const el = document.getElementById('dxyChg');
    el.textContent = `${pct.text} on the day`;
    el.className = `driver-chg ${pct.dir}`;
  }
  if (yield10y && !yield10y.error) {
    // NOTE: Yahoo's ^TNX has historically been quoted as 10x the actual
    // yield by CBOE convention. As of writing, Yahoo's chart endpoint
    // returns the plain percentage (e.g. 4.69 = 4.69%) — but verify this
    // against another source the first time you run it, and divide by 10
    // here if your reading looks 10x too high.
    document.getElementById('yieldValue').textContent = `${fmtNum(yield10y.price, { maximumFractionDigits: 2 })}%`;
    const pct = fmtPct(yield10y.changePercent);
    const el = document.getElementById('yieldChg');
    el.textContent = `${pct.text} on the day`;
    el.className = `driver-chg ${pct.dir}`;
  }
}

// ---------- render: market wire ----------

function renderWire(news) {
  const buckets = Object.values(news).flatMap((arr) => (Array.isArray(arr) ? arr : []));
  if (!buckets.length) {
    document.getElementById('wireList').innerHTML =
      `<div class="wire-item"><div class="wire-time">—</div><div><p class="wire-headline">No headlines came back — check the feed URLs in src/providers/news.js.</p></div></div>`;
    return;
  }
  const html = buckets
    .slice(0, 12)
    .map((item) => `
      <div class="wire-item">
        <div class="wire-time">${item.pubDate ? new Date(item.pubDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        <div>
          <p class="wire-headline"><a href="${item.link || '#'}" target="_blank" rel="noopener">${item.title || 'Untitled'}</a></p>
        </div>
      </div>`)
    .join('');
  document.getElementById('wireList').innerHTML = html;
}

// ---------- render: India price breakdown ----------

function renderBreakdown(india) {
  if (!india || india.error) {
    document.getElementById('breakdownStack').innerHTML =
      `<div class="stack-row"><span class="lbl">Couldn't compute this right now</span><span class="val">—</span></div>`;
    return;
  }
  const b = india.gold.breakdown;
  const bare = b.inrPerGramBare * 10; // per 10g
  const afterDuty = bare * (1 + b.importDutyPct / 100);
  const html = `
    <div class="stack-row">
      <span class="lbl">Global spot, converted (10g @ ₹${fmtNum(india.usdInr, { maximumFractionDigits: 2 })}/USD)</span>
      <span class="val">${fmtInr(bare)}</span>
    </div>
    <div class="stack-row">
      <span class="lbl">+ Import duty (${b.importDutyPct}%)</span>
      <span class="val">+ ${fmtInr(afterDuty - bare)}</span>
    </div>
    <div class="stack-row">
      <span class="lbl">+ GST (${b.gstPct}%)</span>
      <span class="val">+ ${fmtInr(india.gold.inrPer10g24k - afterDuty)}</span>
    </div>
    <div class="stack-row total">
      <span class="lbl">≈ Estimated 24K rate</span>
      <span class="val">${fmtInr(india.gold.inrPer10g24k)} / 10g</span>
    </div>`;
  document.getElementById('breakdownStack').innerHTML = html;
}

// ---------- render: two boards ----------

function idxRow(name, q) {
  if (!q || q.error) return `<div class="idx-row"><span class="idx-name">${name}</span><span class="idx-vals"><span class="idx-price">—</span></span></div>`;
  const pct = fmtPct(q.changePercent);
  return `<div class="idx-row">
    <span class="idx-name">${name}</span>
    <span class="idx-vals"><span class="idx-price">${fmtNum(q.price)}</span><span class="idx-chg ${pct.dir}">${pct.text}</span></span>
  </div>`;
}

function chipList(items, dir) {
  return (items || []).map((t) => `<span class="chip ${dir}">${t}</span>`).join('');
}

function renderBoards(quotes, movers) {
  document.getElementById('usIdxList').innerHTML =
    idxRow('S&amp;P 500', quotes.sp500) +
    idxRow('Dow Jones', quotes.dow) +
    idxRow('Nasdaq Composite', quotes.nasdaq) +
    idxRow('Russell 2000', quotes.russell2000) +
    idxRow('VIX', quotes.vix);

  document.getElementById('inIdxList').innerHTML =
    idxRow('Sensex (BSE)', quotes.sensex) +
    idxRow('Nifty 50 (NSE)', quotes.nifty) +
    idxRow('USD/INR', quotes.usdinr) +
    idxRow('Crude oil', quotes.crude);

  if (movers && !movers.error) {
    document.getElementById('usGainers').innerHTML = chipList(movers.us?.gainers, 'up');
    document.getElementById('usLaggards').innerHTML = chipList(movers.us?.laggards, 'down');
    document.getElementById('inGainers').innerHTML = chipList(movers.india?.gainers, 'up');
    document.getElementById('inLaggards').innerHTML = chipList(movers.india?.laggards, 'down');
  }
}

// ---------- render: catalysts calendar ----------

function renderCalendar(calendar) {
  if (!Array.isArray(calendar) || !calendar.length) {
    document.getElementById('calList').innerHTML = `<div class="cal-row"><div class="cal-date">—</div><div><p class="cal-title">No upcoming events set</p><p class="cal-body">Add entries to data/calendar.json.</p></div></div>`;
    return;
  }
  const html = calendar
    .map((e) => `
      <div class="cal-row">
        <div class="cal-date">${e.label}</div>
        <div><p class="cal-title">${e.title}</p><p class="cal-body">${e.body}</p></div>
      </div>`)
    .join('');
  document.getElementById('calList').innerHTML = html;
}

// ---------- boot ----------

async function init() {
  renderMasthead();

  const results = await Promise.allSettled([
    getJSON('/api/quotes'),
    getJSON('/api/returns'),
    getJSON('/api/india-metals'),
    getJSON('/api/news'),
    getJSON('/api/movers'),
    getJSON('/api/calendar')
  ]);

  const [quotesR, returnsR, indiaR, newsR, moversR, calendarR] = results;
  const quotes = quotesR.status === 'fulfilled' ? quotesR.value : {};

  try { renderTape(quotes); } catch (e) { console.error('tape', e); }
  try { renderMetalsHero(quotes, indiaR.status === 'fulfilled' ? indiaR.value : null); } catch (e) { console.error('hero', e); }
  try { renderTrend(returnsR.status === 'fulfilled' ? returnsR.value : {}); } catch (e) { console.error('trend', e); }
  try { renderDrivers(quotes); } catch (e) { console.error('drivers', e); }
  try { renderWire(newsR.status === 'fulfilled' ? newsR.value : {}); } catch (e) { console.error('wire', e); }
  try { renderBreakdown(indiaR.status === 'fulfilled' ? indiaR.value : null); } catch (e) { console.error('breakdown', e); }
  try { renderBoards(quotes, moversR.status === 'fulfilled' ? moversR.value : null); } catch (e) { console.error('boards', e); }
  try { renderCalendar(calendarR.status === 'fulfilled' ? calendarR.value : []); } catch (e) { console.error('calendar', e); }

  const failures = results.filter((r) => r.status === 'rejected').length;
  const status = document.getElementById('statusLine');
  const stamp = new Date().toLocaleTimeString();
  status.textContent = failures
    ? `Loaded with ${failures} source(s) unavailable · ${stamp}`
    : `Live · updated ${stamp}`;
  document.getElementById('lastUpdatedFooter').textContent = `Last fetched ${stamp}`;
}

init();
// Refresh every 2 minutes. Yahoo's endpoint is unofficial — keep this
// interval polite so you don't get rate-limited or blocked.
setInterval(init, 2 * 60 * 1000);
