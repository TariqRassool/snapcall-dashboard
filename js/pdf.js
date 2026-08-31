async function exportPDF() {
  const overlay  = ge('pdf-overlay');
  const progress = ge('pdf-progress');
  overlay.style.display = 'flex';
  progress.textContent  = 'Gathering data…';

  try {
    const sc     = getSC();
    const tt     = getTT();
    const agents = buildAgents(sc, tt);
    const g      = def('goals', GOALS);
    const org    = def('org', 'Cin7 Support');

    // ── METRICS ──
    const totalSnaps   = agents.reduce((s,a) => s + a.snaps, 0);
    const totalTickets = tt.reduce((s,r) => s + (+(r.tickets)||0), 0);
    const overallRate  = totalTickets > 0 ? totalSnaps / totalTickets * 100 : 0;

    const coreAgents = agents.filter(a => a.product === 'Core');
    const omniAgents = agents.filter(a => a.product === 'Omni');
    const ttCore     = tt.filter(r => r.product === 'Core').reduce((s,r)=>s+(+(r.tickets)||0),0);
    const ttOmni     = tt.filter(r => r.product === 'Omni').reduce((s,r)=>s+(+(r.tickets)||0),0);
    const coreSnaps  = coreAgents.reduce((s,a)=>s+a.snaps,0);
    const omniSnaps  = omniAgents.reduce((s,a)=>s+a.snaps,0);
    const coreRate   = ttCore > 0 ? coreSnaps/ttCore*100 : 0;
    const omniRate   = ttOmni > 0 ? omniSnaps/ttOmni*100 : 0;

    const csatAgents = agents.filter(a=>a.csat>0);
    const avgCsat    = csatAgents.length ? csatAgents.reduce((s,a)=>s+a.csat,0)/csatAgents.length : 0;
    const resAgents  = agents.filter(a=>a.avgRes>0);
    const avgRes     = resAgents.length ? resAgents.reduce((s,a)=>s+a.avgRes,0)/resAgents.length : 0;
    const onTarget   = agents.filter(a=>a.rate>=g.overall).length;

    const wmAll      = S.g('wm') || [];
    const wmTotInit  = wmAll.reduce((s,w)=>s+(w.initiatedCount||0),0);
    const wmTotTotal = wmAll.reduce((s,w)=>s+(w.totalCount||0),0);
    const wmOverall  = wmTotTotal > 0 ? Math.round(wmTotInit/wmTotTotal*100) : null;

    // ── LEADERBOARD — all agents sorted by snaps ──
    const ranked = [...agents].sort((a,b)=>b.snaps-a.snaps);
    const top3Csat = [...agents].filter(a=>a.csat>0).sort((a,b)=>b.csat-a.csat).slice(0,3);
    const top3Res  = [...agents].filter(a=>a.avgRes>0).sort((a,b)=>a.avgRes-b.avgRes).slice(0,3);

    // ── TREND — force Jan–Aug (or whatever months exist) with month labels ──
    const trendMonths = sortYM([...new Set([...sc.map(r=>r.month),...tt.map(r=>r.month)])].filter(Boolean));
    const trendPoints = trendMonths.map(m => {
      const s = sc.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.snaps)||0),0);
      const t = tt.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.tickets)||0),0);
      return t > 0 ? +(s/t*100).toFixed(1) : 0;
    });
    // Short month name only (Jan, Feb…) for x-axis
    const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthShortLabels = trendMonths.map(m => {
      const mn = parseInt(m.split('-')[1],10);
      return MSHORT[mn-1] || m;
    });

    // ── CHART SVG — bar chart, all months on x-axis ──
    const chartW = 680, chartH = 160, padL = 32, padB = 24, padT = 16;
    const innerW = chartW - padL, innerH = chartH - padB - padT;
    let chartSVG = '<div style="color:#8fadd4;font-size:11px;padding:20px 0;text-align:center">No data for selected period</div>';
    if (trendPoints.length > 0) {
      const maxV   = Math.max(...trendPoints, g.overall * 1.3, 5);
      const n      = trendPoints.length;
      const barW   = Math.min(Math.floor((innerW / n) * 0.55), 44);
      const gap    = innerW / n;
      const goalY  = padT + innerH - (g.overall/maxV)*innerH;

      const bars = trendPoints.map((v,i) => {
        const bh   = Math.max((v/maxV)*innerH, v>0?2:0);
        const bx   = padL + gap*i + (gap-barW)/2;
        const by   = padT + innerH - bh;
        const col  = v >= g.overall ? '#05cbbf' : v >= g.overall*0.7 ? '#f5a623' : '#e5eef8';
        const lx   = bx + barW/2;
        const ly   = by - 5;
        return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${Math.max(bh,0).toFixed(1)}" fill="${col}" rx="3"/>
          ${v>0?`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#4a6fa0" font-family="Inter,sans-serif" font-weight="600">${v}%</text>`:''}`;
      }).join('');

      const xLabels = monthShortLabels.map((label,i) => {
        const lx = padL + gap*i + gap/2;
        return `<text x="${lx.toFixed(1)}" y="${(chartH-6).toFixed(1)}" text-anchor="middle" font-size="9" fill="#8fadd4" font-family="Inter,sans-serif">${label}</text>`;
      }).join('');

      // Y axis ticks
      const yTicks = [0, Math.round(maxV/2), Math.round(maxV)].map(v => {
        const ty = padT + innerH - (v/maxV)*innerH;
        return `<line x1="${padL}" y1="${ty.toFixed(1)}" x2="${(padL+innerW).toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#f0f4ff" stroke-width="1"/>
          <text x="${(padL-4).toFixed(1)}" y="${(ty+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#c0cfe0" font-family="Inter,sans-serif">${v}%</text>`;
      }).join('');

      chartSVG = `<svg width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="display:block;overflow:visible">
        ${yTicks}
        <line x1="${padL}" y1="${goalY.toFixed(1)}" x2="${(padL+innerW).toFixed(1)}" y2="${goalY.toFixed(1)}" stroke="#f5a623" stroke-width="1.5" stroke-dasharray="6,4"/>
        <text x="${(padL+innerW+4).toFixed(1)}" y="${(goalY+3.5).toFixed(1)}" font-size="8.5" fill="#f5a623" font-family="Inter,sans-serif">Goal</text>
        ${bars}
        ${xLabels}
      </svg>`;
    }

    // ── FUN INSIGHTS ──
    const insights = [];

    // Trend direction
    if (trendPoints.length >= 2) {
      const last = trendPoints[trendPoints.length-1];
      const prev = trendPoints[trendPoints.length-2];
      const diff = +(last - prev).toFixed(1);
      const mn   = monthShortLabels[monthShortLabels.length-1] || 'last month';
      if (diff >= 2)
        insights.push({ icon:'🚀', title:'On the up!', body:`Adoption climbed ${diff}pp in ${mn} to ${last}%. The momentum is real — keep it going.` });
      else if (diff <= -2)
        insights.push({ icon:'📉', title:'Slight dip in '+mn, body:`We dropped ${Math.abs(diff)}pp to ${last}% — nothing that a few extra SnapCalls can't fix. Who's picking it back up next month?` });
      else
        insights.push({ icon:'📊', title:'Holding steady', body:`Adoption sat at ${last}% in ${mn}. Consistency is underrated — now let's nudge it higher.` });
    }

    // On target count
    if (agents.length > 0) {
      const pct = Math.round(onTarget/agents.length*100);
      if (pct >= 70)
        insights.push({ icon:'🎯', title:`${pct}% of the team is hitting goal`, body:`${onTarget} out of ${agents.length} specialists are at or above ${g.overall}%. That's a squad moment right there.` });
      else if (pct >= 40)
        insights.push({ icon:'💪', title:'More than halfway there', body:`${onTarget}/${agents.length} specialists are at goal. The other ${agents.length-onTarget} are close — one extra SnapCall per ticket could tip the balance.` });
      else
        insights.push({ icon:'🌱', title:'Room to grow', body:`${onTarget}/${agents.length} specialists are at the ${g.overall}% goal. Plenty of opportunity to learn from the top performers below!` });
    }

    // Product rivalry
    if (coreRate > 0 && omniRate > 0) {
      const leader  = coreRate >= omniRate ? 'Core' : 'Omni';
      const trailer = coreRate >= omniRate ? 'Omni' : 'Core';
      const gap     = Math.abs(coreRate - omniRate).toFixed(1);
      insights.push({ icon:'⚔️', title:`Cin7 ${leader} leads by ${gap}pp`, body:`Core is at ${coreRate.toFixed(1)}% and Omni is at ${omniRate.toFixed(1)}%. Friendly competition between the two teams? The ${trailer} crew has a gap to close.` });
    }

    // CSAT
    if (avgCsat > 0) {
      if (avgCsat >= g.csat)
        insights.push({ icon:'⭐', title:`Customers love SnapCall tickets`, body:`Average CSAT on SnapCall tickets is ${avgCsat.toFixed(2)}/5. That's above target. Turns out showing your face (or screen) goes a long way.` });
      else
        insights.push({ icon:'💬', title:'CSAT is close', body:`We're at ${avgCsat.toFixed(2)}/5 against a ${g.csat}/5 target. Small tweaks to how we introduce SnapCall to customers could push this over the line.` });
    }

    // Specialist-initiated
    if (wmOverall !== null) {
      if (wmOverall >= 60)
        insights.push({ icon:'🎬', title:`${wmOverall}% of sessions were specialist-initiated`, body:`More than half the SnapCall activity was kicked off by the team, not the customer. That's proactive support in action.` });
      else
        insights.push({ icon:'💡', title:`${wmOverall}% specialist-initiated`, body:`${100-wmOverall}% of SnapCall sessions were triggered by the customer or system. Flipping that ratio — by sending the link first — is the biggest lever we have.` });
    }

    // Top performer shoutout
    if (ranked.length > 0) {
      const top = ranked[0];
      const firstName = top.name.split(' ')[0];
      insights.push({ icon:'🌟', title:`${firstName} is leading the way`, body:`${fmt(top.snaps)} SnapCall interactions and a ${top.rate.toFixed(1)}% adoption rate. If you want to know what good looks like, ask ${firstName}.` });
    }

    // ── DATE LABEL ──
    let dateLabel = '';
    if (customRange.from) {
      dateLabel = ymLabel(customRange.from) + ' → ' + ymLabel(customRange.to);
    } else {
      const preset = ge('date-preset').value;
      const optEl  = ge('date-preset').querySelector(`option[value="${preset}"]`);
      dateLabel = optEl ? optEl.textContent.trim() : preset;
    }
    const exportDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    // ── STATUS HELPERS ──
    const sc2 = (v,gl) => v >= gl ? '#05cbbf' : v >= gl*0.7 ? '#f5a623' : '#e84545';
    const sl  = (v,gl) => v >= gl ? 'On target ✓' : v >= gl*0.7 ? 'Near target' : 'Below goal';

    progress.textContent = 'Rendering infographic…';

    // ── BUILD HTML ──
    const src = ge('pdf-canvas-source');
    src.style.width      = '794px';
    src.style.padding    = '0';
    src.style.background = '#f2f5fb';

    src.innerHTML = `
    <div style="font-family:'Inter',sans-serif;width:794px;background:#f2f5fb;color:#002e6e">

      <!-- ░░ HEADER ░░ -->
      <div style="background:linear-gradient(150deg,#001e4d 0%,#003080 60%,#004499 100%);padding:44px 48px 40px;position:relative;overflow:hidden">
        <!-- decorative circles -->
        <div style="position:absolute;right:-50px;top:-50px;width:260px;height:260px;border-radius:50%;border:40px solid rgba(5,203,191,.07)"></div>
        <div style="position:absolute;right:80px;bottom:-80px;width:200px;height:200px;border-radius:50%;border:30px solid rgba(5,203,191,.05)"></div>
        <div style="position:absolute;left:-30px;bottom:-40px;width:140px;height:140px;border-radius:50%;border:20px solid rgba(255,255,255,.04)"></div>

        <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(5,203,191,.15);border:1px solid rgba(5,203,191,.3);border-radius:20px;padding:4px 12px;margin-bottom:18px">
              <div style="width:7px;height:7px;border-radius:50%;background:#05cbbf"></div>
              <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.4px;color:#05cbbf">${org}</span>
            </div>
            <div style="font-size:13px;font-weight:400;color:rgba(255,255,255,.5);margin-bottom:6px;letter-spacing:.3px">It's all about</div>
            <div style="font-size:38px;font-weight:800;color:#fff;line-height:1;letter-spacing:-1px;margin-bottom:8px">SnapCall</div>
            <div style="font-size:13px;color:rgba(255,255,255,.45)">${dateLabel}</div>
          </div>
          <!-- big adoption number -->
          <div style="text-align:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:20px 28px">
            <div style="font-size:11px;font-weight:500;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Overall Adoption</div>
            <div style="font-size:48px;font-weight:800;color:${sc2(overallRate,g.overall)};line-height:1;letter-spacing:-2px">${overallRate.toFixed(1)}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:6px">Goal: ${g.overall}%</div>
            <div style="margin-top:10px;display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:${sc2(overallRate,g.overall)}22;color:${sc2(overallRate,g.overall)};border:1px solid ${sc2(overallRate,g.overall)}55">${sl(overallRate,g.overall)}</div>
          </div>
        </div>

        <!-- teal wave divider -->
        <div style="position:absolute;bottom:-1px;left:0;right:0;height:20px;overflow:hidden">
          <svg viewBox="0 0 794 20" width="794" height="20" preserveAspectRatio="none" style="display:block">
            <path d="M0,0 C200,20 594,0 794,14 L794,20 L0,20 Z" fill="#f2f5fb"/>
          </svg>
        </div>
      </div>

      <div style="padding:32px 44px 40px">

        <!-- ░░ KPI STRIP ░░ -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
          ${[
            { emoji:'🎥', label:'SnapCall Sessions', val:fmt(totalSnaps), sub:`of ${fmt(totalTickets)} tickets` },
            { emoji:'⭐', label:'Avg CSAT', val:avgCsat>0?avgCsat.toFixed(2)+'/5':'—', sub:`Target: ${g.csat}/5`, color:avgCsat>0?sc2(avgCsat,g.csat):null },
            { emoji:'⚡', label:'Avg Resolution', val:avgRes>0?avgRes.toFixed(1)+'d':'—', sub:`Goal: ${g.art} days` },
            { emoji:'🎯', label:'On Target', val:`${onTarget}/${agents.length}`, sub:`at or above ${g.overall}%` },
          ].map(k=>`
            <div style="background:#fff;border-radius:14px;padding:16px 14px;box-shadow:0 1px 6px rgba(0,46,110,.07);text-align:center">
              <div style="font-size:22px;margin-bottom:8px">${k.emoji}</div>
              <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#a0b4cc;margin-bottom:5px">${k.label}</div>
              <div style="font-size:20px;font-weight:800;color:${k.color||'#002e6e'};line-height:1">${k.val}</div>
              <div style="font-size:9px;color:#7a98b8;margin-top:4px">${k.sub}</div>
            </div>`).join('')}
        </div>

        <!-- ░░ PRODUCT SPLIT ░░ -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px">
          ${[
            { key:'Core', rate:coreRate, snaps:coreSnaps, tickets:ttCore, agents:coreAgents.length, goal:g.core, col:'#05cbbf', bg:'linear-gradient(135deg,rgba(5,203,191,.1),rgba(5,203,191,.02))', border:'rgba(5,203,191,.3)' },
            { key:'Omni', rate:omniRate, snaps:omniSnaps, tickets:ttOmni, agents:omniAgents.length, goal:g.omni, col:'#002e6e', bg:'linear-gradient(135deg,rgba(229,240,255,.7),#fff)', border:'rgba(0,46,110,.15)' },
          ].map(p=>{
            const barW = Math.min(p.rate/Math.max(p.goal,1)*100,100).toFixed(0);
            return `<div style="background:${p.bg};border:1px solid ${p.border};border-radius:14px;padding:22px 20px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div>
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${p.col};margin-bottom:3px">Cin7 ${p.key}</div>
                  <div style="font-size:11px;color:#7a98b8">${p.agents} specialists · ${fmt(p.snaps)} sessions</div>
                </div>
                <div style="font-size:30px;font-weight:800;color:${p.col};letter-spacing:-1px">${p.tickets>0?p.rate.toFixed(1)+'%':'—'}</div>
              </div>
              <div style="height:6px;background:rgba(0,46,110,.08);border-radius:3px;overflow:hidden">
                <div style="width:${barW}%;height:100%;background:${p.col};border-radius:3px;transition:width .4s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:9px;color:#a0b4cc;margin-top:5px">
                <span>${fmt(p.tickets)} total tickets</span><span>Goal: ${p.goal}%</span>
              </div>
            </div>`;
          }).join('')}
        </div>

        <!-- ░░ TREND CHART ░░ -->
        <div style="background:#fff;border-radius:14px;padding:22px 20px 14px;margin-bottom:28px;box-shadow:0 1px 6px rgba(0,46,110,.07)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;font-weight:700;color:#002e6e">Adoption by Month</div>
            <div style="display:flex;gap:14px">
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#7a98b8"><div style="width:10px;height:4px;background:#05cbbf;border-radius:2px"></div>On/above goal</div>
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#7a98b8"><div style="width:10px;height:4px;background:#f5a623;border-radius:2px"></div>Near goal</div>
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#7a98b8"><div style="width:10px;height:4px;background:#e5eef8;border-radius:2px"></div>Below goal</div>
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#f5a623"><div style="width:14px;height:1px;background:#f5a623;border-top:2px dashed #f5a623"></div>Goal ${g.overall}%</div>
            </div>
          </div>
          ${chartSVG}
        </div>

        <!-- ░░ INSIGHTS ░░ -->
        ${insights.length > 0 ? `
        <div style="margin-bottom:28px">
          <div style="font-size:13px;font-weight:700;color:#002e6e;margin-bottom:14px">What the numbers are telling us 👀</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${insights.map(ins=>`
              <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 6px rgba(0,46,110,.07);display:flex;gap:12px;align-items:flex-start">
                <div style="font-size:22px;flex-shrink:0;margin-top:2px">${ins.icon}</div>
                <div>
                  <div style="font-size:12px;font-weight:700;color:#002e6e;margin-bottom:4px">${ins.title}</div>
                  <div style="font-size:11px;color:#4a6fa0;line-height:1.6">${ins.body}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- ░░ SNAPCALL SUPERSTARS ░░ -->
        ${ranked.length > 0 ? `
        <div style="background:linear-gradient(135deg,#001e4d,#003080);border-radius:16px;padding:28px 28px 24px;margin-bottom:28px">
          <div style="text-align:center;margin-bottom:22px">
            <div style="font-size:20px;margin-bottom:6px">🚀</div>
            <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-.3px">SnapCall Superstars!</div>
            <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:4px">Ranked by SnapCall sessions · ${dateLabel}</div>
          </div>

          <!-- top 3 podium row -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
            ${ranked.slice(0,3).map((a,i)=>{
              const medals  = ['🥇','🥈','🥉'];
              const borders = ['rgba(5,203,191,.5)','rgba(255,255,255,.2)','rgba(201,124,58,.4)'];
              const vals    = ['#05cbbf','rgba(255,255,255,.8)','#c97c3a'];
              const ini     = a.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
              const fn      = a.name.split(' ')[0];
              return `<div style="background:rgba(255,255,255,.07);border:1px solid ${borders[i]};border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:22px;margin-bottom:8px">${medals[i]}</div>
                <div style="width:42px;height:42px;border-radius:50%;background:${vals[i]};color:#002e6e;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">${ini}</div>
                <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:2px">${fn}</div>
                <div style="font-size:9px;color:rgba(255,255,255,.4);margin-bottom:10px">${a.product?'Cin7 '+a.product:''}</div>
                <div style="font-size:20px;font-weight:800;color:${vals[i]}">${fmt(a.snaps)}</div>
                <div style="font-size:9px;color:rgba(255,255,255,.35);margin-bottom:4px">sessions</div>
                <div style="font-size:10px;color:rgba(255,255,255,.6)">${a.rate.toFixed(1)}% adoption</div>
              </div>`;
            }).join('')}
          </div>


        </div>` : ''}

        <!-- ░░ CSAT + RESOLUTION ░░ -->
        ${(top3Csat.length > 0 || top3Res.length > 0) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px">
          ${top3Csat.length > 0 ? `
          <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 6px rgba(0,46,110,.07)">
            <div style="font-size:12px;font-weight:700;color:#002e6e;margin-bottom:14px">⭐ Top CSAT</div>
            ${top3Csat.map((a,i)=>`
              <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;${i<top3Csat.length-1?'border-bottom:1px solid #f0f4ff':''}">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:22px;height:22px;border-radius:50%;background:${['#fbbf24','#e2e8f0','#c97c3a'][i]};color:${i===1?'#64748b':'#fff'};font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${i+1}</div>
                  <span style="font-size:12px;color:#002e6e;font-weight:${i===0?'600':'400'}">${a.name.split(' ')[0]}</span>
                </div>
                <span style="font-size:12px;font-weight:700;color:#f5a623">${a.csat.toFixed(2)}/5</span>
              </div>`).join('')}
          </div>` : ''}
          ${top3Res.length > 0 ? `
          <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 6px rgba(0,46,110,.07)">
            <div style="font-size:12px;font-weight:700;color:#002e6e;margin-bottom:14px">⚡ Best Resolution Time</div>
            ${top3Res.map((a,i)=>`
              <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;${i<top3Res.length-1?'border-bottom:1px solid #f0f4ff':''}">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:22px;height:22px;border-radius:50%;background:${['#fbbf24','#e2e8f0','#c97c3a'][i]};color:${i===1?'#64748b':'#fff'};font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center">${i+1}</div>
                  <span style="font-size:12px;color:#002e6e;font-weight:${i===0?'600':'400'}">${a.name.split(' ')[0]}</span>
                </div>
                <span style="font-size:12px;font-weight:700;color:#4a6fa0">${a.avgRes.toFixed(1)}d</span>
              </div>`).join('')}
          </div>` : ''}
        </div>` : ''}

        <!-- ░░ FOOTER ░░ -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid rgba(0,46,110,.1)">
          <div style="font-size:9px;color:#a0b4cc">SnapCall AI · Part of the Cin7 Quality Framework</div>
          <div style="font-size:9px;color:#a0b4cc">${dateLabel} · ${exportDate}</div>
        </div>

      </div>
    </div>`;

    await new Promise(r => setTimeout(r, 600));
    progress.textContent = 'Capturing screenshot…';

    const canvas = await html2canvas(src, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f2f5fb',
      width: 794,
      windowWidth: 794,
      logging: false
    });

    progress.textContent = 'Creating PDF…';
    const { jsPDF } = window.jspdf;
    // Page width = A4 width (210mm), page height = whatever the content is — one continuous page, no slicing
    const pdfW  = 210;
    const pdfH  = (canvas.height / canvas.width) * pdfW;
    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);

    const safeDate = dateLabel.replace(/[^a-zA-Z0-9\-]/g,'_').replace(/__+/g,'_');
    pdf.save(`SnapCall_Report_${safeDate}.pdf`);

  } catch(err) {
    console.error('[PDF Export]', err);
    alert('PDF export failed. Please try again.\n\n' + err.message);
  } finally {
    overlay.style.display = 'none';
    const src = ge('pdf-canvas-source');
    if (src) { src.innerHTML=''; src.style.width='1100px'; src.style.padding='48px 52px 52px'; src.style.background='#f9f6f3'; }
  }
}
