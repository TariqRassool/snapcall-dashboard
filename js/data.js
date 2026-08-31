// ── DATE RANGE ──
// Strategy: 'custom' lives inside the select like any other option.
// On change, if 'custom' is chosen we open the popup and remember the previous value.
// On cancel, we revert the select back to that previous value — no click/mousedown needed.

let customRange = { from: '', to: '' };
let _prevPreset  = 'last90';  // last non-custom value, used to revert on cancel
let _dateListenersAttached = false;

function initDateRange() {
  if (_dateListenersAttached) return;
  _dateListenersAttached = true;

  const sel = ge('date-preset');

  sel.addEventListener('change', () => {
    if (sel.value === 'custom') {
      openCustomRange();
    } else {
      _prevPreset = sel.value;
      customRange = { from: '', to: '' };
      renderAll();
    }
  });

  ge('cr-cancel').addEventListener('click', closeCustomRange);
  ge('cr-apply').addEventListener('click', applyCustomRange);
  ge('custom-overlay').addEventListener('click', e => {
    if (e.target === ge('custom-overlay')) closeCustomRange();
  });
  ge('cr-from').addEventListener('change', validateCustomRange);
  ge('cr-to').addEventListener('change',   validateCustomRange);
}

function openCustomRange() {
  const now  = new Date();
  const fmt  = d => d.toISOString().slice(0, 10);
  const fromEl = ge('cr-from'), toEl = ge('cr-to');
  if (customRange.from) {
    fromEl.value = customRange.from + '-01';
    toEl.value   = customRange.to   + '-01';
  } else {
    const d3 = new Date(now); d3.setMonth(now.getMonth() - 2);
    fromEl.value = fmt(d3);
    toEl.value   = fmt(now);
  }
  ge('cr-hint').textContent = '';
  ge('custom-overlay').style.display = 'flex';
  fromEl.focus();
}

function closeCustomRange() {
  ge('custom-overlay').style.display = 'none';
  // Revert select to the last non-custom value so the dropdown looks right
  ge('date-preset').value = customRange.from ? 'custom' : _prevPreset;
}

function validateCustomRange() {
  const f = ge('cr-from').value, t = ge('cr-to').value;
  if (f && t && f > t) {
    ge('cr-hint').style.color   = 'var(--red)';
    ge('cr-hint').textContent   = 'From date must be before To date';
  } else {
    ge('cr-hint').textContent = '';
  }
}

function applyCustomRange() {
  const f = ge('cr-from').value, t = ge('cr-to').value;
  if (!f || !t) { ge('cr-hint').style.color='var(--red)'; ge('cr-hint').textContent='Please select both dates.'; return; }
  if (f > t)    { ge('cr-hint').style.color='var(--red)'; ge('cr-hint').textContent='From date must be before To date.'; return; }
  customRange.from = f.slice(0, 7);
  customRange.to   = t.slice(0, 7);
  ge('date-preset').querySelector('option[value="custom"]').textContent =
    ymLabel(customRange.from) + ' → ' + ymLabel(customRange.to);
  ge('date-preset').value = 'custom';
  ge('custom-overlay').style.display = 'none';
  renderAll();
}

// Returns {from, to} as YYYY-MM strings based on the selected preset
function getDateRange() {
  const preset = ge('date-preset') ? ge('date-preset').value : 'all';
  if (preset === 'custom') {
    return { from: customRange.from, to: customRange.to };
  }
  const now = new Date();
  const toDate = new Date(now);
  let fromDate = new Date(now);

  if (preset === 'all')           return { from: '', to: '' };
  if (preset === 'today')         { /* fromDate = now */ }
  else if (preset === 'yesterday')    { fromDate.setDate(now.getDate() - 1); toDate.setDate(now.getDate() - 1); }
  else if (preset === 'thisweek')     { const day = now.getDay() || 7; fromDate.setDate(now.getDate() - day + 1); }
  else if (preset === 'prevweek')     { const day = now.getDay() || 7; fromDate.setDate(now.getDate() - day - 6); toDate.setDate(now.getDate() - day); }
  else if (preset === 'thismonth')    { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (preset === 'prevmonth')    { fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); toDate = new Date(now.getFullYear(), now.getMonth(), 0); }
  else if (preset === 'thisyear')     { fromDate = new Date(now.getFullYear(), 0, 1); }
  else if (preset === 'prevyear')     { fromDate = new Date(now.getFullYear() - 1, 0, 1); toDate = new Date(now.getFullYear() - 1, 11, 31); }
  else if (preset === 'last7')        { fromDate.setDate(now.getDate() - 6); }
  else if (preset === 'last30')       { fromDate.setDate(now.getDate() - 29); }
  else if (preset === 'last90')       { fromDate.setDate(now.getDate() - 89); }
  else if (preset === 'last6m')       { fromDate.setMonth(now.getMonth() - 6); }
  else if (preset === 'last12m')      { fromDate.setMonth(now.getMonth() - 12); }
  else if (preset === 'last24m')      { fromDate.setMonth(now.getMonth() - 24); }

  const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return { from: ym(fromDate), to: ym(toDate) };
}

function inRange(m) {
  if (!m) return false;
  const { from, to } = getDateRange();
  if (!from && !to) return true;
  if (from && m < from) return false;
  if (to   && m > to)   return false;
  return true;
}

// ── DATA ACCESSORS ──
function agentMap() {
  const m = {};
  (S.g('agents') || []).forEach(a => m[a.name] = a);
  return m;
}

function getSC() {
  return (S.g('sc') || []).map(r => ({...r, month: dateToYearMonth(r.month)})).filter(r => r.month && inRange(r.month));
}

function getTT() {
  return (S.g('tt') || []).map(r => ({...r, month: dateToYearMonth(r.month)})).filter(r => r.month && inRange(r.month));
}

function ttByProd(rows) {
  const m = {};
  rows.forEach(r => { m[r.product] = (m[r.product] || 0) + (+(r.tickets) || 0); });
  return m;
}

// ── BUILD AGENTS ──
// Joins SnapCall rows + ticket rows to produce per-agent adoption stats.
function buildAgents(scRows, ttRows) {
  const am = agentMap();

  const agentTicketsByMon = {};
  const brandTicketsByMon = {};
  const namedTTRows = ttRows.filter(r => r.name && r.name.trim());
  const hasByAgent  = namedTTRows.length > 0;

  ttRows.forEach(r => {
    const tix = +(r.tickets) || 0;
    const ym  = dateToYearMonth(r.month);
    const mn  = ym ? ym.split('-')[1] : null;
    if (!mn) return;
    if (r.name && r.name.trim()) {
      const k = r.name.trim() + '-' + mn;
      agentTicketsByMon[k] = (agentTicketsByMon[k] || 0) + tix;
    }
    if (r.brand) {
      const k = r.brand + '-' + mn;
      brandTicketsByMon[k] = (brandTicketsByMon[k] || 0) + tix;
    }
  });
  const totAll = ttRows.reduce((s, r) => s + (+(r.tickets) || 0), 0);

  const m = {};
  scRows.forEach(r => {
    if (!r.name) return;
    const k    = r.name;
    const team = am[k] ? am[k].team || '' : '';
    if (team.trim().toLowerCase() === 'other teams') return;
    if (!m[k]) m[k] = { name: k, product: r.product, snaps: 0, cs: 0, cn: 0, res: 0, rn: 0, team, tagCounts: { call:0, clip:0, flow:0, handled:0, missed:0 } };
    m[k].snaps += +(r.snaps) || 0;
    const tag = (r.tag||'').toLowerCase();
    if (['snapcall_outbound_call','snapcall_call'].includes(tag)) m[k].tagCounts.call++;
    else if (['snapcall_outbound_clip','snapcall_clip','snapcall_clip_video','snapcall_public_page','snapcall_media_uploaded'].includes(tag)) m[k].tagCounts.clip++;
    else if (tag.includes('flow')) m[k].tagCounts.flow++;
    if (tag==='snapcall_call_handled') m[k].tagCounts.handled++;
    if (tag==='snapcall_call_missed')  m[k].tagCounts.missed++;
    if (r.product) m[k].product = r.product;
    if (am[k] && am[k].team) m[k].team = am[k].team;
    const c = +(r.csat); if (!isNaN(c) && c > 0) { m[k].cs += c; m[k].cn++; }
    const res = +(r.resolution); if (!isNaN(res) && res > 0) { m[k].res += res; m[k].rn++; }
  });

  // Join word mention data, filtered to the current date range
  const allWM = S.g('wm') || [];
  const wmData = allWM.map(w => {
    const monthsInRange = (w.months || []).filter(m => inRange(m));
    if (monthsInRange.length === 0) return { ...w, initiatedPct: null, initiatedCount: null };
    return w;
  });
  const wmMap = {};
  wmData.forEach(w => { if (w.name) wmMap[w.name] = w; });

  const g = def('goals', GOALS);
  return Object.values(m).map(a => {
    let denom = 0;
    if (hasByAgent) {
      Object.keys(agentTicketsByMon).forEach(k => {
        if (k.startsWith(a.name + '-')) denom += agentTicketsByMon[k];
      });
    }
    if (denom === 0) {
      const brandTotal = Object.entries(brandTicketsByMon)
        .filter(([k]) => a.product && k.startsWith(a.product + '-'))
        .reduce((s, [, v]) => s + v, 0);
      denom = brandTotal || totAll;
    }
    const rate    = denom > 0 ? a.snaps / denom * 100 : 0;
    const csat    = a.cn > 0 ? a.cs / a.cn : 0;
    const avgRes  = a.rn > 0 ? a.res / a.rn : 0;
    const aScore  = g.overall > 0 ? Math.min(rate / g.overall * 100, 100) : 0;
    const cScore  = g.csat > 0 && csat > 0 ? Math.min(csat / g.csat * 100, 100) : 0;
    const rScore  = g.art > 0 && avgRes > 0 ? Math.min(g.art / avgRes * 100, 100) : 0;
    const cnt     = 1 + (cScore > 0 ? 1 : 0) + (rScore > 0 ? 1 : 0);
    const composite = Math.round((aScore + cScore + rScore) / cnt);
    const wm = wmMap[a.name];
    return { ...a, rate, csat, avgRes, composite, agentTickets: denom,
      initiatedPct: wm ? wm.initiatedPct : null,
      initiatedCount: wm ? wm.initiatedCount : null };
  });
}

// ── BUILD TREND ──
// Returns monthly adoption rate series for charting.
function buildTrend(product) {
  const sc  = getSC();
  const tt  = getTT();
  const scF = product ? sc.filter(r => r.product === product) : sc;
  const ttF = product ? tt.filter(r => r.product === product) : tt;
  const mm  = {};

  ttF.forEach(r => {
    if (!r.month) return;
    const k = r.month;
    if (!/^\d{4}-\d{2}$/.test(k)) return;
    if (!mm[k]) mm[k] = { t: 0, s: 0 };
    mm[k].t += +(r.tickets) || 0;
  });

  scF.forEach(r => {
    if (!r.name || !r.month) return;
    const k = r.month;
    if (!/^\d{4}-\d{2}$/.test(k)) return;
    if (!mm[k]) mm[k] = { t: 0, s: 0 };
    mm[k].s += +(r.snaps) || 0;
  });

  const sorted = Object.keys(mm).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const labels = sorted.map(ym => {
    const [yr, mn] = ym.split('-').map(Number);
    return MSHORT[mn - 1] + ' ' + yr;
  });

  const rates = sorted.map(ym =>
    mm[ym].t > 0 ? +(mm[ym].s / mm[ym].t * 100).toFixed(1) : 0
  );

  return { months: labels, rates };
}
