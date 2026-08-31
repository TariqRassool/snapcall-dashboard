// ── RENDER ORCHESTRATION ──
function renderAll() {
  const pg = document.querySelector('.pg.on');
  if (pg) renderPage(pg.id.replace('pg-', ''));
}

function renderPage(pg) {
  const sc = getSC(), tt = getTT(), agents = buildAgents(sc, tt), goals = def('goals', GOALS);
  if (pg === 'overview')  renderOverview(sc, tt, agents, goals);
  else if (pg === 'agents')   renderAgents();
  else if (pg === 'teams')    renderTeams();
  else if (pg === 'channels') renderChannels();
  else if (pg === 'products') renderProducts(tt, agents, goals);
  else if (pg === 'admin')    renderAdmin();
}

// ── NAVIGATION ──
function goto(pg) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('on'));
  const pageEl = ge('pg-' + pg);
  const btnEl  = ge('n-' + pg);
  if (pageEl) pageEl.classList.add('on');
  if (btnEl)  btnEl.classList.add('on');
  if (pg !== 'admin') adminUnlocked = false;
  const banner = ge('info-banner');
  if (banner) banner.style.display = pg === 'admin' ? 'none' : 'block';
  if (pg === 'admin') {
    if (adminUnlocked) {
      ge('admin-gate').style.display    = 'none';
      ge('admin-content').style.display = 'block';
      renderAdmin();
    } else {
      ge('admin-gate').style.display    = 'flex';
      ge('admin-content').style.display = 'none';
      ge('pin-input').value = '';
      ge('pin-err').textContent = '';
      setTimeout(() => ge('pin-input').focus(), 80);
    }
    return;
  }
  renderPage(pg);
}

// ── OVERVIEW ──
function renderOverview(sc, tt, agents, goals) {
  const totSnaps = agents.reduce((s, a) => s + a.snaps, 0);
  const totTix   = tt.reduce((s, r) => s + (+(r.tickets) || 0), 0);
  const rate     = totTix > 0 ? totSnaps / totTix * 100 : 0;
  const ca       = agents.filter(a => a.csat > 0);
  const avgC     = ca.length ? ca.reduce((s, a) => s + a.csat, 0) / ca.length : 0;
  const ra       = agents.filter(a => a.avgRes > 0);
  const avgRes   = ra.length ? ra.reduce((s, a) => s + a.avgRes, 0) / ra.length : 0;
  const tot      = ttByProd(tt);
  const cS       = agents.filter(a => a.product === 'Core').reduce((s, a) => s + a.snaps, 0);
  const oS       = agents.filter(a => a.product === 'Omni').reduce((s, a) => s + a.snaps, 0);
  const cT = tot['Core'] || 0, oT = tot['Omni'] || 0;
  const cR = cT > 0 ? cS / cT * 100 : 0, oR = oT > 0 ? oS / oT * 100 : 0;
  const rc = rcolor(rate, goals.overall);

  const wmAll       = S.g('wm') || [];
  const wmTotInit   = wmAll.reduce((s, w) => s + (w.initiatedCount || 0), 0);
  const wmTotTotal  = wmAll.reduce((s, w) => s + (w.totalCount    || 0), 0);
  const wmOverall   = wmTotTotal > 0 ? Math.round(wmTotInit / wmTotTotal * 100) : null;
  const wmMonths    = [...new Set(wmAll.flatMap(w => w.months || []))].sort();
  const MSHORT2     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const wmMonthLabel = wmMonths.length > 0
    ? wmMonths.map(ym => { const [yr,mn]=ym.split('-').map(Number); return MSHORT2[mn-1]+' '+yr; }).join(', ')
    : null;

  ge('ov-kpis').innerHTML =
    kpi('Overall Adoption', rate.toFixed(1) + '%', `Goal: ${goals.overall}%`, rbadge(rate, goals.overall), rc) +
    kpiTooltip('SnapCall Interactions', fmt(totSnaps), `of ${fmt(totTix)} total tickets`, '', 'var(--teal)',
      `<strong style="color:#fff">What is this?</strong><br>The total number of SnapCall sessions on tickets assigned to your support team — calls, clips, flows and scheduled calls combined.<br><br><strong style="color:#fff">Why is it different from Specialist-initiated?</strong><br>This counts all SnapCall activity including customer-triggered sessions and system events. Specialist-initiated only counts tickets where a specialist actively sent a SnapCall link.`) +
    (wmOverall !== null
      ? kpiTooltip('Specialist-initiated', wmOverall + '%', `${fmt(wmTotInit)} of ${fmt(wmTotTotal)} tickets`,
          wmOverall >= 70 ? '<span class="kb up">▲ High proactivity</span>' : wmOverall >= 40 ? '<span class="kb wn">⬤ Moderate</span>' : '<span class="kb dn">▼ Mostly passive</span>',
          'var(--navy)',
          `<strong style="color:#fff">What is this?</strong><br>Of all SnapCall-tagged tickets, the % where a specialist proactively sent a SnapCall link in a public reply to the customer.<br><br><strong style="color:#fff">Coverage: </strong>${wmMonthLabel || 'unknown period'}<br>${fmt(wmTotInit)} of ${fmt(wmTotTotal)} tickets<br><br><strong style="color:#fff">Why is the total lower than SnapCall Interactions?</strong><br>This is based on a separate word mention report which may cover fewer months than the SnapCall usage data.`)
      : kpiTooltip('Specialist-initiated', '—', 'Import word mention CSV to see', '', 'var(--t2)',
          `<strong style="color:#fff">No data yet</strong><br>Import a word mention CSV under Admin → Import to see how often specialists are proactively using SnapCall.`)) +
    kpi('Avg CSAT', avgC > 0 ? avgC.toFixed(2) + ' / 5' : '—', `Target: ${goals.csat} / 5`,
      avgC > 0 ? `<span class="kb ${avgC >= goals.csat ? 'up' : 'wn'}">${avgC >= goals.csat ? '▲ On target' : '⬤ Near target'}</span>` : '', 'var(--t1)');

  const pct = Math.min(rate / goals.overall * 100, 100), R = 64, circ = 2 * Math.PI * R, dash = circ * pct / 100;
  ge('ov-ring').innerHTML = `<svg width="168" height="168" viewBox="0 0 168 168"><circle cx="84" cy="84" r="${R}" fill="none" stroke="#e5f0ff" stroke-width="11"/><circle cx="84" cy="84" r="${R}" fill="none" stroke="${rc}" stroke-width="11" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}" stroke-linecap="round" transform="rotate(-90 84 84)"/><text x="84" y="79" text-anchor="middle" fill="#002e6e" font-size="21" font-weight="700" font-family="Syne,sans-serif">${rate.toFixed(1)}%</text><text x="84" y="98" text-anchor="middle" fill="#4a6fa0" font-size="11" font-family="Inter,sans-serif">of ${goals.overall}% goal</text></svg><div class="rm"><div class="rmr"><span>Cin7 Core</span><strong style="color:var(--teal)">${cT > 0 ? cR.toFixed(1) + '%' : '—'}</strong></div><div class="rmr"><span>Cin7 Omni</span><strong style="color:var(--navy)">${oT > 0 ? oR.toFixed(1) + '%' : '—'}</strong></div><div class="rmr"><span>CSAT avg</span><strong>${avgC > 0 ? avgC.toFixed(2) + ' / 5' : '—'}</strong></div><div class="rmr"><span>On target</span><strong style="color:var(--teal)">${agents.filter(a => a.rate >= goals.overall).length} / ${agents.length}</strong></div></div>`;

  const { months, rates } = buildTrend();
  ge('trend-leg').innerHTML = `<div class="li"><span class="ld" style="background:var(--teal)"></span>Overall %</div><div class="li"><span class="ld" style="background:rgba(5,203,191,.3)"></span>Goal ${goals.overall}%</div>`;
  dc('c-trend');
  if (ge('c-trend')) charts['c-trend'] = new Chart(ge('c-trend').getContext('2d'), {
    type: 'line',
    data: { labels: months.length ? months : ['No data'], datasets: [
      { label: '%', data: rates, borderColor: '#05cbbf', backgroundColor: 'rgba(5,203,191,0.07)', borderWidth: 2, pointBackgroundColor: '#05cbbf', pointRadius: 4, tension: .45, fill: true },
      { label: 'Goal', data: Array(Math.max(months.length, 1)).fill(goals.overall), borderColor: 'rgba(5,203,191,.3)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }
    ] }, options: cOpts()
  });

  ge('ov-pcards').innerHTML = pCardHTML('Core', cS, cT, cR, agents.filter(a => a.product === 'Core').length, goals.core) + pCardHTML('Omni', oS, oT, oR, agents.filter(a => a.product === 'Omni').length, goals.omni);
  miniChart('c-core-ov', 'Core', '#05cbbf', goals.core);
  miniChart('c-omni-ov', 'Omni', '#7ea8d8', goals.omni);
}

// ── AGENTS ──
function initiatedBadge(a) {
  if (a.initiatedPct === null || a.initiatedPct === undefined)
    return '<span style="font-size:11px;color:var(--t3)">—</span>';
  if (a.initiatedPct >= 70)
    return `<span style="background:rgba(5,203,191,.12);color:#0a8a82;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px">${a.initiatedPct}%</span>`;
  if (a.initiatedPct >= 40)
    return `<span style="background:rgba(245,166,35,.12);color:#b87d0e;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px">${a.initiatedPct}%</span>`;
  return `<span style="background:rgba(232,69,69,.08);color:#c42020;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px">${a.initiatedPct}%</span>`;
}

function usageStyle(a) {
  const tc  = a.tagCounts || { call:0, clip:0, flow:0 };
  const max = Math.max(tc.call, tc.clip, tc.flow);
  if (max === 0) return '<span style="font-size:11px;color:var(--t3)">—</span>';
  if (tc.call >= tc.clip && tc.call >= tc.flow)
    return '<span style="background:rgba(5,203,191,.12);color:#0a8a82;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">📞 Call-first</span>';
  if (tc.clip >= tc.call && tc.clip >= tc.flow)
    return '<span style="background:rgba(0,46,110,.08);color:#002e6e;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">🎬 Clip-first</span>';
  return '<span style="background:rgba(245,166,35,.12);color:#b87d0e;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">🔄 Flow-first</span>';
}

function renderAgents() {
  const sc = getSC(), tt = getTT();
  let agents = buildAgents(sc, tt);
  const goals = def('goals', GOALS);
  const pf = ge('af-prod').value, tf = ge('af-team').value, sf = ge('af-sort').value;
  const teams = [...new Set(agents.map(a => a.team).filter(Boolean))].sort();
  const prev  = ge('af-team').value;
  ge('af-team').innerHTML = '<option value="all">All teams</option>' + teams.map(t => `<option value="${t}" ${t === prev ? 'selected' : ''}>${t}</option>`).join('');
  if (pf !== 'all') agents = agents.filter(a => a.product === pf);
  if (tf !== 'all') agents = agents.filter(a => a.team === tf);
  const sorts = { score_d: (a, b) => b.composite - a.composite, snaps_d: (a, b) => b.snaps - a.snaps, rate_d: (a, b) => b.rate - a.rate, rate_a: (a, b) => a.rate - b.rate, csat_d: (a, b) => b.csat - a.csat, res_a: (a, b) => a.avgRes - b.avgRes, name: (a, b) => a.name.localeCompare(b.name) };
  const listAgents = [...agents].sort(sorts[sf] || sorts.snaps_d);
  renderPodium(agents, goals, 'podium-wrap');
  ge('rest-lbl').textContent = `All specialists (${listAgents.length})`;
  ge('rest-lbl').style.display = listAgents.length ? 'block' : 'none';
  ge('agents-list').innerHTML = listAgents.length ? listAgents.map(a => {
    const rc = rcolor(a.rate, goals.overall);
    return `<div class="tmr" style="grid-template-columns:2fr 1.4fr 1fr 1fr 1fr 1fr 1fr"><div style="min-width:0;overflow:hidden;padding-left:0"><span style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${a.name}</span></div><div style="display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden"><span class="bdg ${(a.product || '').toLowerCase()}" style="flex-shrink:0">${prodLabel(a.product)}</span>${a.team ? '<span style="font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.team + '</span>' : ''}</div><div style="font-weight:500">${fmt(a.snaps)}</div><div><div class="rc" style="justify-content:center"><div class="rbg" style="width:50px"><div class="rbf" style="width:${Math.min(a.rate,100).toFixed(0)}%;background:${rc};height:3px"></div></div><span class="mono" style="color:${rc}">${a.rate.toFixed(1)}%</span></div></div><div style="color:var(--t2)">${a.csat > 0 ? a.csat.toFixed(2) + '/5' : '—'}</div><div>${initiatedBadge(a)}</div><div>${usageStyle(a)}</div></div>`;
  }).join('') : '<div class="empty">No agent data found for this filter</div>';
}

function renderPodium(agents, goals, containerId) {
  const el = ge(containerId || 'podium-wrap');
  if (!agents.length) {
    el.innerHTML = `<div class="empty"><div style="font-size:28px;margin-bottom:8px">🏆</div>Import data to see top performers</div>`;
    return;
  }
  const withRate = agents.filter(a => a.rate > 0);
  const withCsat = agents.filter(a => a.csat > 0);
  const withRes  = agents.filter(a => a.avgRes > 0);
  const top3Rate = [...withRate].sort((a,b) => b.snaps - a.snaps).slice(0,3);
  const top3Csat = [...withCsat].sort((a,b) => b.csat - a.csat).slice(0,3);
  const top3Res  = [...withRes].sort((a,b) => a.avgRes - b.avgRes).slice(0,3);
  const medals   = ['🥇','🥈','🥉'];

  function catCard(agent, rank, valueHTML) {
    const firstName = agent.name.split(' ')[0];
    const ini = agent.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    const cls = ['p1','p2','p3'][rank];
    return `<div class="pc ${cls}" style="flex:1;min-width:100px;max-width:190px;min-height:200px;display:flex;flex-direction:column;align-items:center;text-align:center">
      <div class="pc-rank">${medals[rank]}</div>
      <div class="pc-av">${ini}</div>
      <div class="pc-name" style="font-size:13px;text-align:center">${firstName}</div>
      <div style="margin-bottom:10px;font-size:11px;text-align:center"><span class="bdg ${(agent.product||'').toLowerCase()}">${prodLabel(agent.product)}</span></div>
      <div style="font-family:var(--head);font-size:20px;font-weight:700;color:var(--navy);text-align:center">${valueHTML}</div>
    </div>`;
  }

  function section(title, icon, color, top3, cardFn) {
    if (!top3.length) return `<div style="flex:1"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${color};margin-bottom:14px;display:flex;align-items:center;gap:6px">${icon} ${title}</div><div style="font-size:12px;color:var(--t2);padding:16px 0">No data available</div></div>`;
    return `<div style="flex:1;min-width:280px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${color};margin-bottom:18px;display:flex;align-items:center;gap:6px">${icon} ${title}</div>
      <div style="display:flex;gap:8px;align-items:stretch">${top3.map((a,i) => cardFn(a,i)).join('')}</div>
    </div>`;
  }

  const adoptionSection = section('Most SnapCalls Initiated', '📈', '#05cbbf', top3Rate, (a,i) =>
    catCard(a, i, fmt(a.snaps)));

  const csatSection = section('Top CSAT Score', '⭐', '#f5a623', top3Csat, (a,i) =>
    catCard(a, i, a.csat.toFixed(2) + ' / 5'));

  const artSection = section('Best Resolution Time', '⚡', '#4a6fa0', top3Res, (a,i) =>
    catCard(a, i, a.avgRes.toFixed(1) + 'd'));

  el.innerHTML = `<div style="display:flex;gap:24px;margin-bottom:28px;padding:0 4px">${adoptionSection}${csatSection}${artSection}</div>`;
}

// ── TEAMS ──
function renderTeams() {
  const sc = getSC(), tt = getTT(), agents = buildAgents(sc, tt), goals = def('goals', GOALS);
  const pf = ge('tf-prod').value, tf2 = ge('tf-team').value;
  let filtered = [...agents];
  if (pf !== 'all') filtered = filtered.filter(a => a.product === pf);
  const allTeams = [...new Set(agents.map(a => a.team).filter(Boolean))].sort();
  const prev = ge('tf-team').value;
  ge('tf-team').innerHTML = '<option value="all">All teams</option>' + allTeams.map(t => `<option value="${t}" ${t === prev ? 'selected' : ''}>${t}</option>`).join('');
  if (tf2 !== 'all') filtered = filtered.filter(a => a.team === tf2);
  const tmap = {};
  filtered.forEach(a => { const t = a.team || 'Unassigned'; if (!tmap[t]) tmap[t] = []; tmap[t].push(a); });
  const names = Object.keys(tmap).sort();
  if (!names.length) { ge('teams-content').innerHTML = `<div class="empty">No team data. Assign agents to teams in Admin › Team Assignments.</div>`; return; }
  ge('teams-content').innerHTML = names.map(team => {
    const members  = [...tmap[team]].sort((a, b) => b.snaps - a.snaps);
    const top1Rate = [...members].filter(a=>a.rate>0).sort((a,b)=>b.rate-a.rate)[0];
    const top1Csat = [...members].filter(a=>a.csat>0).sort((a,b)=>b.csat-a.csat)[0];
    const top1Res  = [...members].filter(a=>a.avgRes>0).sort((a,b)=>a.avgRes-b.avgRes)[0];
    const teamSnaps = members.reduce((s, a) => s + a.snaps, 0);
    const teamRate  = members.length ? members.reduce((s, a) => s + a.rate, 0) / members.length : 0;
    const cca = members.filter(a => a.csat > 0);
    const avgCsat = cca.length ? cca.reduce((s, a) => s + a.csat, 0) / cca.length : 0;
    const prods = [...new Set(members.map(a => a.product).filter(Boolean))];
    return `<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px"><div><div style="font-family:var(--head);font-size:16px;font-weight:700">${team}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">${members.length} specialist${members.length !== 1 ? 's' : ''} · ${prods.map(p => `<span class="bdg ${p.toLowerCase()}">${prodLabel(p)}</span>`).join(' ')}</div></div><div style="display:flex;gap:18px;text-align:right"><div><div style="font-family:var(--head);font-size:19px;font-weight:700;color:${rcolor(teamRate,goals.overall)}">${teamRate.toFixed(1)}%</div><div style="font-size:11px;color:var(--t2)">Team adoption</div></div><div><div style="font-family:var(--head);font-size:19px;font-weight:700">${fmt(teamSnaps)}</div><div style="font-size:11px;color:var(--t2)">SnapCalls</div></div><div><div style="font-family:var(--head);font-size:19px;font-weight:700">${avgCsat > 0 ? avgCsat.toFixed(2) + '/5' : '—'}</div><div style="font-size:11px;color:var(--t2)">CSAT avg</div></div></div></div>${(top1Rate||top1Csat||top1Res) ? `<div style="margin-bottom:14px">
  <div class="stag" style="color:var(--amber)">⭐ Category leaders</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    ${top1Rate ? `<div style="background:var(--s3);border:1px solid rgba(5,203,191,.2);border-radius:var(--r);padding:11px 13px;flex:1;min-width:140px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--teal);margin-bottom:5px">📈 Top Adoption</div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">${top1Rate.name}</div>
      <div style="font-size:12px;color:var(--t2)">${top1Rate.rate.toFixed(1)}% adoption · ${fmt(top1Rate.snaps)} SnapCalls</div>
    </div>` : ''}
    ${top1Csat ? `<div style="background:var(--s3);border:1px solid rgba(245,166,35,.2);border-radius:var(--r);padding:11px 13px;flex:1;min-width:140px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--amber);margin-bottom:5px">⭐ Top CSAT</div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">${top1Csat.name}</div>
      <div style="font-size:12px;color:var(--t2)">${top1Csat.csat.toFixed(2)} / 5 · ${top1Csat.rate.toFixed(1)}% adoption</div>
    </div>` : ''}
    ${top1Res ? `<div style="background:var(--s3);border:1px solid rgba(74,111,160,.2);border-radius:var(--r);padding:11px 13px;flex:1;min-width:140px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--t2);margin-bottom:5px">⚡ Best Resolution</div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">${top1Res.name}</div>
      <div style="font-size:12px;color:var(--t2)">${top1Res.avgRes.toFixed(1)}d avg · ${top1Res.rate.toFixed(1)}% adoption</div>
    </div>` : ''}
  </div>
</div>` : ''}<div class="tmh" style="grid-template-columns:2fr 1.4fr 1fr 1fr 1fr 1fr 1fr"><div style="padding-left:16px">Specialist</div><div>Product / Team</div><div>SnapCalls</div><div>Adoption</div><div>CSAT</div><div>Initiated %</div><div>Usage style</div></div>${members.map((a, idx) => { const rc2 = rcolor(a.rate, goals.overall); return `<div class="tmr${idx < 3 ? ' top3' : ''}" style="grid-template-columns:2fr 1.4fr 1fr 1fr 1fr 1fr 1fr"><div style="min-width:0;overflow:hidden"><span style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${a.name}</span></div><div style="display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden"><span class="bdg ${(a.product||'').toLowerCase()}" style="flex-shrink:0">${prodLabel(a.product)}</span></div><div>${fmt(a.snaps)}</div><div><span class="mono" style="color:${rc2}">${a.rate.toFixed(1)}%</span></div><div style="color:var(--t2)">${a.csat > 0 ? a.csat.toFixed(2)+'/5' : '—'}</div><div>${initiatedBadge(a)}</div><div>${usageStyle(a)}</div></div>`; }).join('')}</div>`;
  }).join('');
}

// ── CHANNELS ──
function renderChannels() {
  try {
    const sc    = getSC(), tt = getTT();
    const goals = def('goals', GOALS);
    const CH_ICONS  = { API:'⚙️', Api:'⚙️', Email:'✉️', Messaging:'💬', Web:'🌐' };
    const CH_COLORS = ['#05cbbf','#002e6e','#f5a623','#4a6fa0','#c97c3a'];

    const TAGS = {
      call:    ['snapcall_outbound_call','snapcall_call','snapcall_outbound_schedule','snapcall_schedule'],
      handled: ['snapcall_call_handled'],
      missed:  ['snapcall_call_missed'],
      joined:  ['snapcall_end_user_joined'],
      clip:    ['snapcall_outbound_clip','snapcall_clip','snapcall_clip_video','snapcall_clip_snapshot','snapcall_clip_audio','snapcall_public_page','snapcall_outbound_public_page','snapcall_media_uploaded'],
      flow:    ['snapcall_flow_start_a_call'],
      media:   ['snapcall_media_uploaded'],
      sched:   ['snapcall_outbound_schedule','snapcall_schedule']
    };
    function tagCat(tag) {
      if (!tag) return 'other';
      if (TAGS.handled.includes(tag)) return 'handled';
      if (TAGS.missed.includes(tag))  return 'missed';
      if (TAGS.joined.includes(tag))  return 'joined';
      if (TAGS.call.includes(tag))    return 'call';
      if (TAGS.clip.includes(tag))    return 'clip';
      if (tag.includes('flow'))       return 'flow';
      return 'other';
    }

    let totCall=0, totHandled=0, totMissed=0, totJoined=0, totClip=0, totFlow=0, totSched=0, totMedia=0;
    sc.forEach(r => {
      const tag = (r.tag||'').trim().toLowerCase();
      const n   = +(r.snaps) || 1;
      const cat = tagCat(tag);
      if (cat==='call')    totCall    += n;
      if (cat==='handled') totHandled += n;
      if (cat==='missed')  totMissed  += n;
      if (cat==='joined')  totJoined  += n;
      if (cat==='clip')    totClip    += n;
      if (cat==='flow')    totFlow    += n;
      if (TAGS.sched.includes(tag)) totSched += n;
      if (TAGS.media.includes(tag)) totMedia += n;
    });
    const totAll         = totCall + totHandled + totMissed + totJoined + totClip + totFlow;
    const callInitiated  = totCall + totHandled + totMissed;
    const completionRate = callInitiated > 0 ? (totHandled / callInitiated * 100).toFixed(0) : null;
    const engagementRate = (totCall + totHandled) > 0 ? ((totJoined + totHandled) / (totCall + totHandled) * 100).toFixed(0) : null;

    ge('usage-kpis').innerHTML = [
      kpi('📞 Calls Initiated',   fmt(callInitiated),  completionRate ? completionRate+'% completion rate' : 'No outcome data', completionRate ? rbadge(+completionRate, 60) : '', '#05cbbf'),
      kpi('🎬 Clips Sent',        fmt(totClip),        totMedia > 0 ? fmt(totMedia)+' customer responses' : 'No media response data', '', '#002e6e'),
      kpi('🔄 Flows Triggered',   fmt(totFlow),        'Custom message flows sent', '', '#f5a623'),
      kpi('🤝 Customer Engaged',  fmt(totJoined + totMedia), 'Joined calls or uploaded media', '', '#4a6fa0')
    ].join('');

    dc('usage-donut');
    const donutCard = ge('usage-donut') ? ge('usage-donut').closest('.card') : null;
    if (donutCard) { const old = donutCard.querySelector('.empty'); if (old) old.remove(); }
    if (ge('usage-donut') && totAll > 0) {
      ge('usage-donut').style.display = '';
      const uLabels = ['Calls','Clips','Flows','Other'];
      const uData   = [callInitiated, totClip, totFlow, Math.max(0, totAll - callInitiated - totClip - totFlow)];
      const uColors = ['#05cbbf','#002e6e','#f5a623','#8fadd4'];
      const filtered = uLabels.map((l,i) => ({l, d: uData[i], c: uColors[i]})).filter(x => x.d > 0);
      charts['usage-donut'] = new Chart(ge('usage-donut').getContext('2d'), {
        type: 'doughnut',
        data: { labels: filtered.map(x=>x.l), datasets: [{ data: filtered.map(x=>x.d), backgroundColor: filtered.map(x=>x.c), borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ display:true, position:'right', labels:{ color:'#002e6e', font:{ size:12 }, padding:14, boxWidth:12 } } } }
      });
    } else if (ge('usage-donut') && totAll === 0) {
      ge('usage-donut').style.display = 'none';
      if (donutCard) donutCard.insertAdjacentHTML('beforeend','<div class="empty" style="padding:40px 0">No tag data — re-import SnapCall CSV with Ticket tags column</div>');
    }

    const outcomesEl = ge('call-outcomes-body');
    if (outcomesEl) {
      if (callInitiated === 0 && totHandled === 0) {
        outcomesEl.innerHTML = '<div class="empty" style="padding:30px 0">No call outcome data yet.<br><span style="font-size:11px;color:var(--t3)">Tags needed: snapcall_call_handled, snapcall_call_missed, snapcall_end_user_joined</span></div>';
      } else {
        const rows = [
          { label: 'Calls initiated',  val: callInitiated, color: '#05cbbf', pct: 100 },
          { label: 'Customer joined',  val: totJoined,     color: '#4a6fa0', pct: callInitiated > 0 ? totJoined/callInitiated*100 : 0 },
          { label: 'Call handled',     val: totHandled,    color: '#0a8a82', pct: callInitiated > 0 ? totHandled/callInitiated*100 : 0 },
          { label: 'Call missed',      val: totMissed,     color: '#e84545', pct: callInitiated > 0 ? totMissed/callInitiated*100 : 0 },
          { label: 'Scheduled calls',  val: totSched,      color: '#f5a623', pct: callInitiated > 0 ? totSched/callInitiated*100 : 0 },
        ];
        outcomesEl.innerHTML = '<div style="padding:10px 4px">' + rows.map(row => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div style="font-size:13px;color:var(--navy);width:140px;flex-shrink:0">${row.label}</div>
            <div style="flex:1;background:var(--ice);border-radius:4px;height:8px;overflow:hidden">
              <div style="width:${Math.min(row.pct,100).toFixed(1)}%;height:100%;background:${row.color};border-radius:4px;transition:width .4s"></div>
            </div>
            <div style="font-family:var(--mono);font-size:12px;color:var(--navy);width:30px;text-align:right">${fmt(row.val)}</div>
            <div style="font-size:11px;color:var(--t2);width:36px;text-align:right">${row.pct < 100 ? row.pct.toFixed(0)+'%' : ''}</div>
          </div>`).join('') + '</div>';
      }
    }

    const agentChannels = {};
    const cm = {};
    sc.forEach(r => {
      const ch   = (r.channel || '').trim() || 'Unknown';
      const name = (r.name || '').trim();
      if (!cm[ch]) cm[ch] = { snaps: 0, agents: new Set() };
      cm[ch].snaps += +(r.snaps) || 0;
      if (name) cm[ch].agents.add(name);
      if (name) { if (!agentChannels[name]) agentChannels[name] = new Set(); agentChannels[name].add(ch); }
    });
    const agentTickets = {};
    tt.forEach(r => { const name=(r.name||'').trim(); if(!name) return; agentTickets[name]=(agentTickets[name]||0)+(+(r.tickets)||0); });
    Object.keys(cm).forEach(ch => {
      let chT=0;
      cm[ch].agents.forEach(name => { const n=agentTickets[name]||0; const nc=agentChannels[name]?agentChannels[name].size:1; chT+=n/nc; });
      cm[ch].totalTickets=Math.round(chT);
      cm[ch].rate=cm[ch].totalTickets>0?cm[ch].snaps/cm[ch].totalTickets*100:0;
    });
    const hasTTAgents=Object.keys(agentTickets).length>0;
    if(!hasTTAgents){const tot=tt.reduce((s,r)=>s+(+(r.tickets)||0),0);const ts=Object.values(cm).reduce((s,v)=>s+v.snaps,0);Object.keys(cm).forEach(ch=>{const sh=ts>0?cm[ch].snaps/ts:0;cm[ch].totalTickets=Math.round(tot*sh);cm[ch].rate=cm[ch].totalTickets>0?cm[ch].snaps/cm[ch].totalTickets*100:0;});}
    const channels=Object.keys(cm).sort((a,b)=>cm[b].snaps-cm[a].snaps);

    if(!channels.length){ge('ch-kpis').innerHTML='';ge('ch-table-body').innerHTML='<div class="empty">No channel data</div>';dc('ch-bar-chart');dc('ch-donut-chart');return;}

    ge('ch-kpis').innerHTML=channels.slice(0,5).map((ch,i)=>{const d=cm[ch],col=CH_COLORS[i%CH_COLORS.length];return kpi((CH_ICONS[ch]||'📌')+' '+ch,fmt(d.snaps),d.rate.toFixed(1)+'% adoption rate',rbadge(d.rate,goals.overall),col);}).join('');
    dc('ch-bar-chart');
    if(ge('ch-bar-chart'))charts['ch-bar-chart']=new Chart(ge('ch-bar-chart').getContext('2d'),{type:'bar',data:{labels:channels,datasets:[{label:'Adoption %',data:channels.map(ch=>+cm[ch].rate.toFixed(1)),backgroundColor:channels.map((_,i)=>CH_COLORS[i%CH_COLORS.length]),borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8fadd4',font:{size:12}},grid:{display:false}},y:{ticks:{color:'#8fadd4',font:{size:11},callback:v=>v+'%'},grid:{color:'rgba(0,46,110,0.06)'},beginAtZero:true}}}});
    dc('ch-donut-chart');
    if(ge('ch-donut-chart'))charts['ch-donut-chart']=new Chart(ge('ch-donut-chart').getContext('2d'),{type:'doughnut',data:{labels:channels,datasets:[{data:channels.map(ch=>cm[ch].snaps),backgroundColor:channels.map((_,i)=>CH_COLORS[i%CH_COLORS.length]),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:true,position:'right',labels:{color:'#002e6e',font:{size:12},padding:14,boxWidth:12}}}}});
    ge('ch-table-body').innerHTML=channels.map((ch,i)=>{const d=cm[ch],rc=rcolor(d.rate,goals.overall),col=CH_COLORS[i%CH_COLORS.length];const barW=Math.min(d.rate/Math.max(goals.overall*2,1)*100,100).toFixed(0);return `<div class="tmr" style="grid-template-columns:1.5fr 1fr 1fr 1fr 1fr"><div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:${col}20;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${CH_ICONS[ch]||'📌'}</div><div style="font-weight:600;color:var(--navy)">${ch}</div></div><div style="font-weight:600">${fmt(d.snaps)}</div><div style="color:var(--t2)">${fmt(d.totalTickets)}</div><div><div style="display:flex;align-items:center;gap:7px;justify-content:center"><div style="width:60px;height:4px;background:var(--ice);border-radius:2px;overflow:hidden"><div style="width:${barW}%;height:100%;background:${rc};border-radius:2px"></div></div><span style="font-family:var(--mono);font-size:12px;color:${rc}">${d.rate.toFixed(1)}%</span></div></div><div>${rbadge(d.rate,goals.overall)}</div></div>`;}).join('');

  } catch(err) {
    console.error('[SnapCall] renderChannels error:', err);
    if(ge('ch-table-body')) ge('ch-table-body').innerHTML='<div class="empty">Could not load channel data — see browser console for details</div>';
  }
}

// ── PRODUCTS ──
function renderProducts(tt, agents, goals) {
  const tot  = ttByProd(tt);
  const core = agents.filter(a => a.product === 'Core');
  const omni = agents.filter(a => a.product === 'Omni');
  const cS = core.reduce((s, a) => s + a.snaps, 0), cT = tot['Core'] || 0;
  const oS = omni.reduce((s, a) => s + a.snaps, 0), oT = tot['Omni'] || 0;
  const cR = cT > 0 ? cS / cT * 100 : 0, oR = oT > 0 ? oS / oT * 100 : 0;
  const cca = core.filter(a => a.csat > 0), oca = omni.filter(a => a.csat > 0);
  const cCA = cca.length ? cca.reduce((s, a) => s + a.csat, 0) / cca.length : 0;
  const oCA = oca.length ? oca.reduce((s, a) => s + a.csat, 0) / oca.length : 0;
  const cra = core.filter(a => a.avgRes > 0), ora = omni.filter(a => a.avgRes > 0);
  const cRes = cra.length ? cra.reduce((s, a) => s + a.avgRes, 0) / cra.length : 0;
  const oRes = ora.length ? ora.reduce((s, a) => s + a.avgRes, 0) / ora.length : 0;
  ge('prod-cards').innerHTML = `<div class="pcard core"><div class="ptag">Core</div><div class="pbrand">Cin7 Core</div><div class="pnum">${cT>0?cR.toFixed(1)+'%':'—'}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">adoption · goal ${goals.core}% &nbsp;${cT>0?rbadge(cR,goals.core):''}</div><div class="prow"><div class="ps"><div class="pl">SnapCalls</div><div class="pv">${fmt(cS)}</div></div><div class="ps"><div class="pl">Total Tickets</div><div class="pv">${fmt(cT)}</div></div><div class="ps"><div class="pl">CSAT avg</div><div class="pv">${cCA>0?cCA.toFixed(2)+'/5':'—'}</div></div><div class="ps"><div class="pl">Avg Res.</div><div class="pv">${cRes>0?cRes.toFixed(1)+'d':'—'}</div></div><div class="ps"><div class="pl">Agents</div><div class="pv">${core.length}</div></div></div></div><div class="pcard omni"><div class="ptag">Omni</div><div class="pbrand">Cin7 Omni</div><div class="pnum">${oT>0?oR.toFixed(1)+'%':'—'}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">adoption · goal ${goals.omni}% &nbsp;${oT>0?rbadge(oR,goals.omni):''}</div><div class="prow"><div class="ps"><div class="pl">SnapCalls</div><div class="pv">${fmt(oS)}</div></div><div class="ps"><div class="pl">Total Tickets</div><div class="pv">${fmt(oT)}</div></div><div class="ps"><div class="pl">CSAT avg</div><div class="pv">${oCA>0?oCA.toFixed(2)+'/5':'—'}</div></div><div class="ps"><div class="pl">Avg Res.</div><div class="pv">${oRes>0?oRes.toFixed(1)+'d':'—'}</div></div><div class="ps"><div class="pl">Agents</div><div class="pv">${omni.length}</div></div></div></div>`;
  miniChart('c-core', 'Core', '#05cbbf', goals.core);
  miniChart('c-omni', 'Omni', '#7ea8d8', goals.omni);
  const t5 = arr => [...arr].sort((a, b) => b.snaps - a.snaps).slice(0, 5);
  const tr = (a, col) => `<tr><td>${a.name}</td><td>${fmt(a.snaps)}</td><td>${a.csat>0?a.csat.toFixed(2)+'/5':'—'}</td><td style="color:var(--t2)">${a.avgRes>0?a.avgRes.toFixed(1)+'d':'—'}</td><td class="mono" style="color:${col}">${a.rate.toFixed(1)}%</td></tr>`;
  ge('core-top').innerHTML = t5(core).map(a => tr(a, 'var(--teal)')).join('') || '<tr><td colspan="5" class="empty">No data</td></tr>';
  ge('omni-top').innerHTML = t5(omni).map(a => tr(a, 'var(--t2)')).join('')   || '<tr><td colspan="5" class="empty">No data</td></tr>';
}
