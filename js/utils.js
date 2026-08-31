// ── UTILS ──
// Shared helper functions used across multiple modules.

const ge = id => document.getElementById(id);

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Parse any date/month format → "YYYY-MM" for grouping and sorting
function dateToYearMonth(s) {
  if (!s) return '';
  s = s.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return mdy[3] + '-' + mdy[1].padStart(2, '0');
  const MNAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const parts = s.toLowerCase().split(/[\s,]+/);
  let yr = '', mo = '';
  parts.forEach(p => {
    const idx = MNAMES.indexOf(p);
    if (idx >= 0) mo = String(idx + 1).padStart(2, '0');
    else if (/^\d{4}$/.test(p)) yr = p;
  });
  if (yr && mo) return yr + '-' + mo;
  if (mo && !yr) return '0000-' + mo;
  return '';
}

// Format "YYYY-MM" → "Jan 2025" for display
function ymLabel(ym) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return MONTH_SHORT[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

// Sort array of YYYY-MM strings chronologically
function sortYM(arr) {
  return [...new Set(arr)].filter(Boolean).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });
}

// ── PRODUCT ──
function normProd(brand) {
  if (!brand) return '';
  const b = brand.toLowerCase();
  if (b.includes('omni')) return 'Omni';
  if (b.includes('core')) return 'Core';
  return '';
}
function prodLabel(k) { return k === 'Core' ? 'Cin7 Core' : k === 'Omni' ? 'Cin7 Omni' : k || '—'; }

// ── DISPLAY HELPERS ──
function fmt(n) { return (+n || 0).toLocaleString(); }

function rcolor(r, g) { return r >= g ? '#0a8a82' : r >= g * .7 ? '#b87d0e' : '#c42020'; }

function rbadge(r, g) {
  if (r >= g)       return '<span class="kb up">▲ On target</span>';
  if (r >= g * .7)  return '<span class="kb wn">⬤ Near goal</span>';
  return '<span class="kb dn">▼ Below goal</span>';
}

function kpi(l, v, s, b, c) {
  return `<div class="kc"><div class="kl">${l}</div><div class="kv" style="color:${c}">${v}</div><div class="ks">${s}</div>${b}</div>`;
}

function kpiTooltip(l, v, sub, badge, c, tooltipText) {
  return `<div class="kc" style="position:relative">
    <div class="kl" style="display:flex;align-items:center;gap:5px">${l}<span class="ktt-icon" aria-label="More info">ⓘ</span></div>
    <div class="kv" style="color:${c}">${v}</div>
    <div class="ks">${sub}</div>
    ${badge}
    <div class="ktt-box" role="tooltip">${tooltipText}</div>
  </div>`;
}

function showN(id, type, msg) {
  const e = ge(id);
  e.className = 'notif ' + type;
  e.textContent = msg;
  setTimeout(() => { e.className = 'notif'; }, 9000);
}

function flashSaved(id) {
  const e = ge(id);
  e.style.display = 'inline';
  setTimeout(() => e.style.display = 'none', 2500);
}

function showPrev(tblId, cardId, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  ge(tblId).innerHTML = `<thead><tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${keys.map(k => `<td style="font-size:11px;white-space:nowrap">${r[k] || ''}</td>`).join('')}</tr>`).join('')}</tbody>`;
  ge(cardId).style.display = 'block';
}

// ── CHART HELPERS ──
function dc(id) {
  if (charts[id]) { try { charts[id].destroy(); } catch(e) {} delete charts[id]; }
}

function cOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#8fadd4', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#8fadd4', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(0,46,110,0.06)' } }
    }
  };
}

function miniChart(id, product, col, goal) {
  dc(id);
  const { months, rates } = buildTrend(product);
  if (!ge(id)) return;
  charts[id] = new Chart(ge(id).getContext('2d'), {
    type: 'line',
    data: {
      labels: months.length ? months : ['—'],
      datasets: [
        { data: rates, borderColor: col, backgroundColor: col + '18', borderWidth: 2, pointRadius: 4, tension: .45, fill: true },
        { data: Array(Math.max(months.length, 1)).fill(goal), borderColor: 'rgba(255,255,255,.1)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }
      ]
    },
    options: cOpts()
  });
}

function pCardHTML(prod, snaps, total, rate, cnt, goal) {
  const cls = prod.toLowerCase();
  return `<div class="pcard ${cls}"><div class="ptag">${prod}</div><div class="pbrand">${prodLabel(prod)}</div><div class="pnum">${total > 0 ? rate.toFixed(1) + '%' : '—'}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">adoption · goal ${goal}% &nbsp;${total > 0 ? rbadge(rate, goal) : ''}</div><div class="prow"><div class="ps"><div class="pl">SnapCalls</div><div class="pv">${fmt(snaps)}</div></div><div class="ps"><div class="pl">Total Tickets</div><div class="pv">${fmt(total)}</div></div><div class="ps"><div class="pl">Agents</div><div class="pv">${cnt}</div></div></div></div>`;
}
