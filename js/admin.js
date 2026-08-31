// ── PIN ──
function unlockAdmin() {
  const pin = ge('pin-input').value.trim();
  if (pin === def('pin', '1234')) {
    adminUnlocked = true;
    ge('admin-gate').style.display    = 'none';
    ge('admin-content').style.display = 'block';
    renderAdmin();
  } else {
    ge('pin-err').textContent = 'Incorrect PIN — try again';
    ge('pin-input').value = '';
    ge('pin-input').focus();
  }
}

// ── ADMIN RENDER ──
function renderAdmin() {
  updateDataStatus();
  renderTeamTable();
  loadGoals();
  loadSettings();
  renderUploadHistory();
}

function updateDataStatus() {
  const sc = S.g('sc') || [], tt = S.g('tt') || [];
  ge('data-st').textContent = sc.length || tt.length
    ? `${fmt(sc.length)} SnapCall rows · ${fmt(tt.length)} ticket volume rows`
    : 'No data loaded yet';
}

// ── ADMIN SUB-TABS ──
function atab(name) {
  ['import', 'teams', 'goals', 'settings'].forEach(t => ge('at-' + t).style.display = 'none');
  ['atp-import', 'atp-teams', 'atp-goals', 'atp-settings'].forEach(id => { const el = ge(id); if (el) el.classList.remove('on'); });
  ge('at-' + name).style.display = 'block';
  const btn = ge('atp-' + name); if (btn) btn.classList.add('on');
  if (name === 'teams') renderTeamTable();
}

// ── TEAM TABLE ──
function renderTeamTable() {
  const agents = S.g('agents') || [];
  ge('team-tbody').innerHTML = agents.length
    ? agents.map((a, i) => `<tr><td style="font-weight:500">${a.name}</td><td><span class="bdg ${(a.product||'').toLowerCase()}">${prodLabel(a.product)}</span></td><td><input type="text" value="${a.team||''}" placeholder="e.g. Core Team A" onchange="saveTeam(${i},this.value)" style="background:var(--s3);border:1px solid var(--b2);border-radius:6px;padding:5px 9px;color:var(--t1);font-family:var(--font);font-size:12px;width:180px"></td><td><input type="text" value="${a.email||''}" placeholder="optional" onchange="saveEmail(${i},this.value)" style="background:var(--s3);border:1px solid var(--b2);border-radius:6px;padding:5px 9px;color:var(--t1);font-family:var(--font);font-size:12px;width:180px"></td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">No agents yet — import the SnapCall CSV first</td></tr>';
}

// These use inline onchange in dynamically generated HTML — must be on window
window.saveTeam  = function(i, v) { const a = S.g('agents') || []; a[i].team  = v; S.s('agents', a); };
window.saveEmail = function(i, v) { const a = S.g('agents') || []; a[i].email = v; S.s('agents', a); };

// ── GOALS / SETTINGS ──
function loadGoals() {
  const g = def('goals', GOALS);
  ge('g-overall').value = g.overall; ge('g-core').value = g.core;
  ge('g-omni').value = g.omni; ge('g-csat').value = g.csat; ge('g-art').value = g.art;
}
function saveGoals() {
  S.s('goals', { overall: +(ge('g-overall').value) || 20, core: +(ge('g-core').value) || 25, omni: +(ge('g-omni').value) || 15, csat: +(ge('g-csat').value) || 4, art: +(ge('g-art').value) || 4 });
  flashSaved('saved-goals'); renderAll();
}
function loadSettings() { ge('s-org').value = def('org', 'Cin7 Support'); }
function saveSettings() {
  const p = ge('s-pin').value.trim();
  if (p) S.s('pin', p);
  S.s('org', ge('s-org').value.trim() || 'Cin7 Support');
  ge('s-pin').value = '';
  flashSaved('saved-settings');
}

// ── CSV HANDLERS ──
function handleSC(e) {
  const f = (e.target || e).files ? (e.target || e).files[0] : e;
  if (!f) return;
  readCSV(f, rows => {
    const parsed = rows.map(r => {
      const mon = (r['ticket solved - month'] || '').trim();
      const yr  = (r['ticket solved - year']  || '').trim();
      const rawDate = (r['ticket solved - date'] || r['month'] || '').trim();
      let ym = '';
      if (mon && yr)    ym = dateToYearMonth(mon + ' ' + yr);
      else if (rawDate) ym = dateToYearMonth(rawDate);
      else if (mon)     ym = dateToYearMonth(mon);
      return {
        month:      ym,
        name:       r['assignee name'] || r['name'] || '',
        snaps:      r['tickets'] || '0',
        csat:       r['csat score'] || r['csat'] || '0',
        resolution: r['first resolution time (days)'] || r['first resolution time'] || r['resolution time (days)'] || '0',
        brand:      r['ticket brand'] || r['brand'] || '',
        product:    normProd(r['ticket brand'] || r['brand'] || ''),
        channel:    r['ticket channel'] || r['channel'] || '',
        tag:        (r['ticket tags'] || r['tags'] || '').trim().toLowerCase()
      };
    }).filter(r => r.name.trim() && r.month);
    if (!parsed.length) { showN('imp-notif', 'err', 'Could not parse SnapCall CSV — check column headers match exactly.'); return; }
    staged.sc = parsed;
    staged.sc_filename = f.name || 'SnapCall CSV';
    ge('sc-st').style.color = 'var(--teal)';
    ge('sc-st').textContent = `✓ ${parsed.length} rows · ${[...new Set(parsed.map(r => r.brand))].join(', ')}`;
    showPrev('prv-sc', 'prv-sc-card', parsed.slice(0, 5));
    checkReady();
  });
}

function handleTT(e) {
  const f = (e.target || e).files ? (e.target || e).files[0] : e;
  if (!f) return;
  readCSV(f, rows => {
    const parsed = rows.map(r => {
      const mon = (r['ticket first assigned - month'] || r['ticket created - month'] || '').trim();
      const yr  = (r['ticket first assigned - year']  || r['ticket created - year']  || '').trim();
      const rawDate = (r['ticket first assigned - date'] || r['ticket created - date'] || r['month'] || '').trim();
      let ym = '';
      if (mon && yr)    ym = dateToYearMonth(mon + ' ' + yr);
      else if (rawDate) ym = dateToYearMonth(rawDate);
      else if (mon)     ym = dateToYearMonth(mon);
      return {
        month:   ym,
        name:    (r['assignee name'] || r['name'] || '').trim(),
        brand:   r['ticket brand'] || r['brand'] || '',
        tickets: r['tickets'] || '0',
        product: normProd(r['ticket brand'] || r['brand'] || '')
      };
    }).filter(r => r.month);
    if (!parsed.length) { showN('imp-notif', 'err', 'Could not parse Total Tickets CSV — check column headers match exactly.'); return; }
    staged.tt = parsed;
    staged.tt_filename = f.name || 'Total Tickets CSV';
    ge('tt-st').style.color = 'var(--teal)';
    const sum = {}; parsed.forEach(r => { sum[r.brand] = (sum[r.brand] || 0) + (+(r.tickets) || 0); });
    ge('tt-st').textContent = `✓ ${parsed.length} rows · ` + Object.entries(sum).map(([b, n]) => `${b}: ${fmt(n)}`).join(' · ');
    showPrev('prv-tt', 'prv-tt-card', parsed.slice(0, 5));
    checkReady();
  });
}

function checkReady() {
  const hasSC = !!staged.sc, hasTT = !!staged.tt, hasWM = !!staged.wm;
  ge('prev-wrap').style.display    = (hasSC || hasTT) ? 'block' : 'none';
  ge('confirm-row').style.display  = (hasSC || hasTT || hasWM) ? 'block' : 'none';
  ge('cpills').innerHTML =
    (hasSC ? `<span class="cpill ok">🎥 SnapCall: ${staged.sc.length} rows</span>` : `<span class="cpill dim">🎥 SnapCall: not loaded</span>`) +
    (hasTT ? `<span class="cpill ok">📋 Total Tickets: ${staged.tt.length} rows</span>` : `<span class="cpill dim">📋 Total Tickets: not loaded</span>`) +
    (hasWM ? `<span class="cpill ok">✍️ Word Mention: ${staged.wm.length} specialists</span>` : `<span class="cpill dim">✍️ Word Mention: not loaded</span>`);
}

function handleWM(e) {
  const f = (e.target || e).files ? (e.target || e).files[0] : e;
  if (!f) return;

  function tsToYearMonth(val) {
    if (!val && val !== 0) return '';
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(date)) return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }
    if (val instanceof Date) return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0');
    const d = new Date(String(val).trim());
    if (!isNaN(d)) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return '';
  }

  function processWMRows(rows) {
    const parsed = rows.map(r => {
      const owner  = (r['Ticket Comment Owner'] || r['ticket comment owner'] || '').trim();
      const msg    = (r['Message'] || r['message'] || '').toLowerCase();
      const pubRaw = r['Public Comment'] !== undefined ? r['Public Comment'] : r['public comment'];
      const pub    = pubRaw === true || String(pubRaw).trim() === 'True';
      const tid    = String(r['Ticket ID'] || r['ticket id'] || '').trim();
      const spec   = (r['Ticket Owner'] || r['ticket owner'] || '').trim();
      const tsRaw  = r['Comment Created At'] || r['comment created at'];
      const month  = tsToYearMonth(tsRaw);
      const isSnapBot  = owner.toLowerCase() === 'snapcall';
      const hasLink    = msg.includes('stream.snapcall.io') || msg.includes('snapcall.io/media');
      const hasMention = msg.includes('snapcall');
      const initiated  = !isSnapBot && pub && (hasLink || hasMention) && owner && owner.toLowerCase() !== 'snapcall';
      return { ticketId: tid, specialist: spec, commentOwner: owner, initiated, isSnapBot, month };
    }).filter(r => r.ticketId);

    if (!parsed.length) { showN('imp-notif', 'err', 'Could not parse Word Mention file — check column headers match exactly.'); return; }

    const monthsInFile = [...new Set(parsed.map(r => r.month).filter(Boolean))].sort();
    const specMap = {};
    parsed.forEach(r => {
      const name = r.specialist;
      if (!name || name.toLowerCase() === 'snapcall') return;
      if (!specMap[name]) specMap[name] = { initiated: new Set(), total: new Set(), months: new Set() };
      specMap[name].total.add(r.ticketId);
      if (r.initiated) specMap[name].initiated.add(r.ticketId);
      if (r.month) specMap[name].months.add(r.month);
    });

    const summary = Object.entries(specMap).map(([name, d]) => ({
      name,
      initiatedCount: d.initiated.size,
      totalCount:     d.total.size,
      initiatedPct:   d.total.size > 0 ? Math.round(d.initiated.size / d.total.size * 100) : 0,
      months:         [...d.months].sort()
    }));

    staged.wm          = summary;
    staged.wm_filename = f.name || 'Word Mention file';
    staged.wm_months   = monthsInFile;

    const scAgents   = S.g('agents') || [];
    const wmNames    = summary.filter(s => s.name).map(s => s.name);
    const wmNewNames = wmNames.filter(n => n && n.toLowerCase() !== 'snapcall' && !scAgents.some(a => a.name === n));
    if (wmNewNames.length > 0 && scAgents.length > 0) {
      const wmCandidates = findDuplicateCandidates(wmNewNames, scAgents);
      if (wmCandidates.length > 0) showDuplicateBanner(wmCandidates);
    }

    ge('dz-wm').classList.add('loaded');
    ge('wm-st').style.color = 'var(--teal)';
    const totalInitiated = summary.reduce((s, a) => s + a.initiatedCount, 0);
    const totalSnap      = summary.reduce((s, a) => s + a.totalCount, 0);
    const overallPct     = totalSnap > 0 ? Math.round(totalInitiated / totalSnap * 100) : 0;
    const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels = monthsInFile.map(ym => {
      const [yr, mn] = ym.split('-').map(Number);
      return (MSHORT[mn-1] || ym) + ' ' + yr;
    }).join(', ');
    ge('wm-st').textContent = `✓ ${summary.length} specialists · ${overallPct}% initiated · ${monthLabels || 'unknown period'}`;

    checkReady();

    const pills = ge('cpills');
    if (pills) {
      const existing = pills.querySelector('.wm-pill');
      if (existing) existing.remove();
      const pill = document.createElement('span');
      pill.className   = 'cpill ok wm-pill';
      pill.textContent = `✍️ Word Mention: ${summary.length} specialists`;
      pills.appendChild(pill);
    }
  }

  const isXlsx = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls');
  if (isXlsx) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) { showN('imp-notif', 'err', 'XLSX library not loaded — please export as CSV first.'); return; }
        const wb   = XLSX.read(ev.target.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true });
        processWMRows(rows);
      } catch(err) {
        showN('imp-notif', 'err', 'Could not read XLSX file — try exporting as CSV instead.');
        console.error(err);
      }
    };
    reader.readAsBinaryString(f);
  } else {
    readCSV(f, processWMRows);
  }
}

function confirmImport() {
  let newAgentNames = [];
  const uploadId  = 'upload_' + Date.now();
  const uploadLog = { id: uploadId, timestamp: Date.now(), sc: null, tt: null };

  if (staged.sc) {
    const ex = S.g('sc') || [];
    const nm = [...new Set(staged.sc.map(r => r.month))];
    S.s('sc', [...ex.filter(r => !nm.includes(r.month)), ...staged.sc]);
    uploadLog.sc = { filename: staged.sc_filename || 'SnapCall CSV', rows: staged.sc.length, months: nm.sort() };
    const existing     = agentMap();
    const isFirstImport = Object.keys(existing).length === 0;
    staged.sc.forEach(r => {
      if (!r.name || !r.name.trim()) return;
      const k = r.name.trim();
      if (!existing[k]) { existing[k] = { name: k, product: r.product, team: '', email: '' }; if (!isFirstImport) newAgentNames.push(k); }
      else existing[k].product = r.product;
    });
    S.s('agents', Object.values(existing));
  }

  if (staged.tt) {
    const ex = S.g('tt') || [];
    const nm = [...new Set(staged.tt.map(r => r.month))];
    S.s('tt', [...ex.filter(r => !nm.includes(r.month)), ...staged.tt]);
    uploadLog.tt = { filename: staged.tt_filename || 'Total Tickets CSV', rows: staged.tt.length, months: nm.sort() };
  }

  if (staged.wm) {
    const existingWM = S.g('wm') || [];
    const newMonths  = staged.wm_months || [];
    const merged     = existingWM.filter(a => {
      const aMonths = a.months || [];
      if (aMonths.length === 0) return false;
      return !aMonths.some(m => newMonths.includes(m));
    });
    staged.wm.forEach(newEntry => {
      const existing = merged.find(a => a.name === newEntry.name);
      if (existing) {
        existing.initiatedCount += newEntry.initiatedCount;
        existing.totalCount     += newEntry.totalCount;
        existing.initiatedPct    = existing.totalCount > 0 ? Math.round(existing.initiatedCount / existing.totalCount * 100) : 0;
        existing.months          = [...new Set([...(existing.months||[]), ...(newEntry.months||[])])].sort();
      } else {
        merged.push(newEntry);
      }
    });
    S.s('wm', merged);
    uploadLog.wm = { filename: staged.wm_filename || 'Word Mention file', count: staged.wm.length, months: newMonths };
  }

  const logs = S.g('uploadLogs') || [];
  logs.unshift(uploadLog);
  S.s('uploadLogs', logs);

  const scMsg = staged.sc ? staged.sc.length + ' SnapCall rows' : '—';
  const ttMsg = staged.tt ? staged.tt.length + ' ticket rows' : '—';
  const wmMsg = staged.wm ? staged.wm.length + ' specialist records' : null;
  showN('imp-notif', 'ok', `✓ Saved — ${scMsg} · ${ttMsg}${wmMsg ? ' · ' + wmMsg : ''} · Now export data.json and commit it to GitHub so everyone sees the update.`);

  if (newAgentNames.length > 0) showNewAgentBanner(newAgentNames);

  const allAgents = S.g('agents') || [];
  const existingAgents = allAgents.filter(a => !newAgentNames.includes(a.name));
  const candidates = findDuplicateCandidates(newAgentNames, existingAgents);
  if (candidates.length > 0) showDuplicateBanner(candidates);

  resetDZ(); initDateRange(); updateDataStatus(); renderUploadHistory(); renderAll();
}

function renderUploadHistory() {
  const el = ge('upload-history-list');
  if (!el) return;
  const logs = S.g('uploadLogs') || [];
  if (!logs.length) { el.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:10px 0">No uploads yet — imports will appear here.</div>'; return; }
  el.innerHTML = logs.map((log, idx) => {
    const date = new Date(log.timestamp);
    const dateStr  = date.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
    const timeStr  = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    const scMonths = log.sc ? log.sc.months.map(ymLabel).join(', ') : null;
    const ttMonths = log.tt ? log.tt.months.map(ymLabel).join(', ') : null;
    return `<div style="background:var(--ice);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:6px">${dateStr} at ${timeStr}</div>
          ${log.sc ? `<div style="font-size:12px;color:var(--t2);margin-bottom:3px">🎥 <strong style="color:var(--navy)">${log.sc.filename}</strong> — ${fmt(log.sc.rows)} rows · <span style="color:var(--teal)">${scMonths}</span></div>` : ''}
          ${log.tt ? `<div style="font-size:12px;color:var(--t2);margin-bottom:3px">📋 <strong style="color:var(--navy)">${log.tt.filename}</strong> — ${fmt(log.tt.rows)} rows · <span style="color:var(--teal)">${ttMonths}</span></div>` : ''}
          ${log.wm ? `<div style="font-size:12px;color:var(--t2)">✍️ <strong style="color:var(--navy)">${log.wm.filename}</strong> — ${fmt(log.wm.count)} specialists · <span style="color:var(--teal)">${(log.wm.months||[]).map(ymLabel).join(', ') || 'unknown period'}</span></div>` : ''}
        </div>
        <button id="del-upload-${idx}" style="background:none;border:1.5px solid var(--red);color:var(--red);border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">🗑 Delete this upload</button>
      </div>
    </div>`;
  }).join('');
  logs.forEach((log, idx) => {
    const btn = ge('del-upload-' + idx);
    if (btn) btn.addEventListener('click', () => deleteUpload(idx));
  });
}

function deleteUpload(idx) {
  const logs = S.g('uploadLogs') || [];
  const log  = logs[idx];
  if (!log) return;
  const parts = [];
  if (log.sc) parts.push('SnapCall data for: '      + log.sc.months.map(ymLabel).join(', '));
  if (log.tt) parts.push('Total Tickets data for: '  + log.tt.months.map(ymLabel).join(', '));
  if (log.wm) parts.push('Word Mention data for: '   + (log.wm.months||[]).map(ymLabel).join(', '));
  if (!confirm('Delete this upload?\n\n' + parts.join('\n') + '\n\nThis cannot be undone.')) return;
  if (log.sc) { const sc = S.g('sc') || []; S.s('sc', sc.filter(r => !log.sc.months.includes(r.month))); }
  if (log.tt) { const tt = S.g('tt') || []; S.s('tt', tt.filter(r => !log.tt.months.includes(r.month))); }
  if (log.wm && log.wm.months && log.wm.months.length) {
    const wm = S.g('wm') || [];
    const updated = wm.map(a => {
      const remaining = (a.months || []).filter(m => !log.wm.months.includes(m));
      if (remaining.length === 0) return null;
      return { ...a, months: remaining };
    }).filter(Boolean);
    S.s('wm', updated);
  }
  logs.splice(idx, 1);
  S.s('uploadLogs', logs);
  showN('imp-notif', 'ok', '✓ Upload deleted. Re-import the corrected file to replace the data.');
  initDateRange(); updateDataStatus(); renderUploadHistory(); renderAll();
}

// ── DUPLICATE DETECTION ──
function nameTokens(s) {
  if (!s) return [];
  s = s.toLowerCase().trim();
  if (s.includes('@')) s = s.split('@')[0];
  return s.split(/[\s._\-]+/).filter(t => t.length >= 3);
}

function nameSimilarity(a, b) {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  let matches = 0;
  ta.forEach(t => { if (tb.includes(t)) matches++; });
  const score = matches / Math.max(ta.length, tb.length);
  const hasStrongMatch = matches >= 2 || ta.some(t => tb.includes(t) && t.length >= 6);
  return hasStrongMatch ? score : 0;
}

function findDuplicateCandidates(newNames, existingAgents) {
  const candidates = [];
  newNames.forEach(newName => {
    existingAgents.forEach(ex => {
      if (ex.name === newName) return;
      const score = nameSimilarity(newName, ex.name);
      if (score >= 0.5) candidates.push({ newName, existingName: ex.name, score, product: ex.product });
    });
  });
  const seen = new Set();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(c => { if (seen.has(c.newName)) return false; seen.add(c.newName); return true; });
}

function mergeAgents(keepName, removeName) {
  const sc = S.g('sc') || [];
  sc.forEach(r => { if (r.name === removeName) r.name = keepName; });
  S.s('sc', sc);
  const tt = S.g('tt') || [];
  tt.forEach(r => { if (r.name === removeName) r.name = keepName; });
  S.s('tt', tt);
  const wm = S.g('wm') || [];
  const removeWM = wm.find(w => w.name === removeName);
  const keepWM   = wm.find(w => w.name === keepName);
  if (removeWM && keepWM) {
    keepWM.initiatedCount += removeWM.initiatedCount;
    keepWM.totalCount     += removeWM.totalCount;
    keepWM.initiatedPct    = keepWM.totalCount > 0 ? Math.round(keepWM.initiatedCount / keepWM.totalCount * 100) : 0;
    keepWM.months          = [...new Set([...(keepWM.months||[]), ...(removeWM.months||[])])].sort();
    S.s('wm', wm.filter(w => w.name !== removeName));
  } else if (removeWM) {
    removeWM.name = keepName;
    S.s('wm', wm);
  }
  const agents     = S.g('agents') || [];
  const removeAgent = agents.find(a => a.name === removeName);
  const keepAgent   = agents.find(a => a.name === keepName);
  if (keepAgent && removeAgent) {
    if (!keepAgent.team  && removeAgent.team)  keepAgent.team  = removeAgent.team;
    if (!keepAgent.email && removeAgent.email) keepAgent.email = removeAgent.email;
  }
  S.s('agents', agents.filter(a => a.name !== removeName));
  renderAll();
}

function showDuplicateBanner(candidates) {
  const old = ge('duplicate-banner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'duplicate-banner';
  banner.style.cssText = 'background:#fff;border:1.5px solid var(--navy);border-radius:var(--r);padding:16px;margin-bottom:16px';
  const rows = candidates.map((c, i) => `
    <div id="dup-row-${i}" style="border:0.5px solid var(--b1);border-radius:var(--r);padding:12px 14px;margin-bottom:10px;background:var(--s3)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:11px;background:rgba(245,166,35,.15);color:#7a5000;font-weight:600;padding:2px 8px;border-radius:20px">Possible duplicate</span>
        <span style="font-size:11px;color:var(--t2)">${Math.round(c.score*100)}% name match</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:var(--s2);border-radius:6px;padding:10px 12px">
          <div style="font-size:10px;color:var(--t3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Existing agent</div>
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${c.existingName}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">${c.product || ''}</div>
        </div>
        <div style="background:var(--s2);border-radius:6px;padding:10px 12px">
          <div style="font-size:10px;color:var(--t3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">New agent</div>
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${c.newName}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">${c.product || ''}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:8px">Which name should be kept?</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="dup-keep-existing-${i}" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">Keep "${c.existingName}"</button>
        <button id="dup-keep-new-${i}" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">Keep "${c.newName}"</button>
        <button id="dup-different-${i}" style="background:none;border:1.5px solid var(--b2);color:var(--t1);border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer">Different people — keep both</button>
      </div>
    </div>
  `).join('');
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span style="font-size:20px">🔍</span>
      <div>
        <div style="font-weight:700;color:var(--navy)">${candidates.length} possible duplicate${candidates.length > 1 ? 's' : ''} found</div>
        <div style="font-size:12px;color:var(--t2)">Review and confirm whether these are the same person before proceeding</div>
      </div>
      <button id="dup-dismiss" style="margin-left:auto;background:none;border:none;font-size:18px;cursor:pointer;color:var(--t2);line-height:1;padding:0;flex-shrink:0">✕</button>
    </div>
    ${rows}
  `;
  const impNotif = ge('imp-notif');
  impNotif.parentNode.insertBefore(banner, impNotif.nextSibling);
  ge('dup-dismiss').addEventListener('click', () => banner.remove());
  candidates.forEach((c, i) => {
    ge('dup-keep-existing-' + i).addEventListener('click', () => {
      mergeAgents(c.existingName, c.newName);
      ge('dup-row-' + i).innerHTML = `<div style="font-size:12px;color:var(--teal)">✓ Merged — all data moved to <strong>${c.existingName}</strong></div>`;
      showN('imp-notif', 'ok', `✓ Merged "${c.newName}" into "${c.existingName}"`);
    });
    ge('dup-keep-new-' + i).addEventListener('click', () => {
      mergeAgents(c.newName, c.existingName);
      ge('dup-row-' + i).innerHTML = `<div style="font-size:12px;color:var(--teal)">✓ Merged — all data moved to <strong>${c.newName}</strong></div>`;
      showN('imp-notif', 'ok', `✓ Merged "${c.existingName}" into "${c.newName}"`);
    });
    ge('dup-different-' + i).addEventListener('click', () => {
      ge('dup-row-' + i).innerHTML = `<div style="font-size:12px;color:var(--t2)">✓ Kept as separate agents</div>`;
    });
  });
}

function showNewAgentBanner(names) {
  const old = ge('new-agent-banner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'new-agent-banner';
  banner.style.cssText = 'background:#fff3cd;border:1.5px solid #f5a623;border-radius:var(--r);padding:14px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px';
  banner.innerHTML = `
    <div style="font-size:20px;flex-shrink:0">🆕</div>
    <div style="flex:1">
      <div style="font-weight:700;color:#7a5000;margin-bottom:4px">${names.length} new agent${names.length > 1 ? 's' : ''} need team assignment</div>
      <div style="font-size:12px;color:#7a5000;margin-bottom:8px">${names.slice(0,5).join(', ')}${names.length > 5 ? ` and ${names.length - 5} more…` : ''}</div>
      <button id="go-to-teams-btn" style="background:var(--navy);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">Go to Team Assignments →</button>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#7a5000;line-height:1;padding:0;flex-shrink:0">✕</button>
  `;
  const impNotif = ge('imp-notif');
  impNotif.parentNode.insertBefore(banner, impNotif.nextSibling);
  ge('go-to-teams-btn').addEventListener('click', () => { atab('teams'); banner.remove(); });
}

function cancelImport() { staged = { sc: null, tt: null, wm: null }; resetDZ(); }

function resetDZ() {
  staged = { sc: null, tt: null };
  ge('confirm-row').style.display = 'none'; ge('prev-wrap').style.display = 'none';
  ge('dz-sc').classList.remove('loaded'); ge('sc-st').textContent = 'Click or drop file here'; ge('sc-st').style.color = 'var(--t3)'; ge('f-sc').value = '';
  ge('dz-tt').classList.remove('loaded'); ge('tt-st').textContent = 'Click or drop file here'; ge('tt-st').style.color = 'var(--t3)'; ge('f-tt').value = '';
  ge('dz-wm').classList.remove('loaded'); ge('wm-st').textContent = 'Click or drop file here'; ge('wm-st').style.color = 'var(--t3)'; ge('f-wm').value = '';
}

function clearAll() {
  if (!confirm('Clear transaction data?\n\nThis removes all imported SnapCall sessions, ticket data and word mentions.\n\nAgent names, team assignments, goals and settings will be kept.')) return;
  S.d('sc'); S.d('tt'); S.d('wm'); S.d('uploadLogs'); S.d('dataTimestamp');
  customRange = { from: '', to: '' };
  _prevPreset = 'last90';
  ge('date-preset').value = 'last90';
  ge('date-preset').querySelector('option[value="custom"]').textContent = 'Custom range…';
  updateDataStatus(); renderAll();
  showN('imp-notif', 'ok', '✓ Transaction data cleared. Agent names, teams, goals and settings have been kept.');
}

function clearEverything() {
  if (!confirm('⚠️ Clear EVERYTHING?\n\nThis will delete all data including:\n• Imported CSV data (SnapCall sessions, tickets, word mentions)\n• Agent names and team assignments\n• Goals and settings\n\nThis cannot be undone. Are you sure?')) return;
  ['sc','tt','wm','agents','goals','org','pin','uploadLogs','dataTimestamp'].forEach(k => S.d(k));
  customRange = { from: '', to: '' };
  _prevPreset = 'last90';
  ge('date-preset').value = 'last90';
  ge('date-preset').querySelector('option[value="custom"]').textContent = 'Custom range…';
  updateDataStatus(); renderAll();
  showN('imp-notif', 'ok', '✓ Everything cleared. Dashboard has been fully reset.');
}

function clearWM() {
  if (!confirm('Delete all word mention data? Your SnapCall usage and ticket data will be kept.')) return;
  S.d('wm');
  const logs = S.g('uploadLogs') || [];
  logs.forEach(l => { if (l.wm) delete l.wm; });
  S.s('uploadLogs', logs);
  updateDataStatus(); renderUploadHistory(); renderAll();
  showN('imp-notif', 'ok', '✓ Word mention data cleared. Re-import your word count CSV to start fresh.');
}

// ── CSV PARSER ──
function readCSV(file, cb) {
  const rd = new FileReader();
  rd.onload = e => {
    const raw = e.target.result;
    const logicalRows = [];
    let current = '', inQuote = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        inQuote = !inQuote;
        current += ch;
      } else if ((ch === '\n' || (ch === '\r' && raw[i+1] === '\n')) && !inQuote) {
        if (ch === '\r') i++;
        logicalRows.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) logicalRows.push(current);
    if (logicalRows.length < 2) { cb([]); return; }
    const hdrs = csvSplit(logicalRows[0]).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    cb(logicalRows.slice(1).map(line => {
      const vals = csvSplit(line), o = {};
      hdrs.forEach((h, i) => o[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''));
      return o;
    }).filter(r => Object.values(r).some(v => v)));
  };
  rd.readAsText(file);
}

function csvSplit(line) {
  const r = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { r.push(c); c = ''; }
    else c += ch;
  }
  r.push(c); return r;
}
