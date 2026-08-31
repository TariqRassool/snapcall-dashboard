async function exportPDF() {
  const overlay  = ge('pdf-overlay');
  const progress = ge('pdf-progress');
  overlay.style.display = 'flex';
  progress.textContent  = 'Gathering data…';

  try {
    const sc  = getSC();
    const tt  = getTT();
    const agents = buildAgents(sc, tt);
    const g   = def('goals', GOALS);
    const org = def('org', 'Cin7 Support');

    // ── CORE METRICS ──
    const totalSnaps   = agents.reduce((s,a) => s + a.snaps, 0);
    const totalTickets = tt.reduce((s,r) => s + (+(r.tickets)||0), 0);
    const overallRate  = totalTickets > 0 ? totalSnaps / totalTickets * 100 : 0;

    const coreAgents = agents.filter(a => a.product === 'Core');
    const omniAgents = agents.filter(a => a.product === 'Omni');
    const ttCore = tt.filter(r => r.product === 'Core').reduce((s,r)=>s+(+(r.tickets)||0),0);
    const ttOmni = tt.filter(r => r.product === 'Omni').reduce((s,r)=>s+(+(r.tickets)||0),0);
    const coreSnaps = coreAgents.reduce((s,a)=>s+a.snaps,0);
    const omniSnaps = omniAgents.reduce((s,a)=>s+a.snaps,0);
    const coreRate  = ttCore > 0 ? coreSnaps / ttCore * 100 : 0;
    const omniRate  = ttOmni > 0 ? omniSnaps / ttOmni * 100 : 0;

    const csatAgents = agents.filter(a => a.csat > 0);
    const avgCsat    = csatAgents.length ? csatAgents.reduce((s,a)=>s+a.csat,0)/csatAgents.length : 0;
    const resAgents  = agents.filter(a => a.avgRes > 0);
    const avgRes     = resAgents.length ? resAgents.reduce((s,a)=>s+a.avgRes,0)/resAgents.length : 0;
    const onTarget   = agents.filter(a => a.rate >= g.overall).length;

    // ── WM DATA ──
    const wmAll      = S.g('wm') || [];
    const wmTotInit  = wmAll.reduce((s,w)=>s+(w.initiatedCount||0),0);
    const wmTotTotal = wmAll.reduce((s,w)=>s+(w.totalCount||0),0);
    const wmOverall  = wmTotTotal > 0 ? Math.round(wmTotInit/wmTotTotal*100) : null;

    // ── TOP PERFORMERS ──
    const top3Snaps = [...agents].sort((a,b)=>b.snaps-a.snaps).slice(0,3);
    const top3Csat  = [...agents].filter(a=>a.csat>0).sort((a,b)=>b.csat-a.csat).slice(0,3);
    const top3Res   = [...agents].filter(a=>a.avgRes>0).sort((a,b)=>a.avgRes-b.avgRes).slice(0,3);

    // ── TREND ──
    const trendMonths = sortYM([...new Set([...sc.map(r=>r.month),...tt.map(r=>r.month)])].filter(Boolean));
    const trendPoints = trendMonths.map(m => {
      const s = sc.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.snaps)||0),0);
      const t = tt.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.tickets)||0),0);
      return t > 0 ? +(s/t*100).toFixed(1) : 0;
    });
    const monthLabels = trendMonths.map(m => ymLabel(m));

    // ── INSIGHTS ──
    const insights = [];
    if (trendPoints.length >= 2) {
      const last = trendPoints[trendPoints.length-1];
      const prev = trendPoints[trendPoints.length-2];
      const diff = last - prev;
      if (Math.abs(diff) >= 1) {
        insights.push(diff > 0
          ? `📈 Adoption is trending up — ${last.toFixed(1)}% last month, up ${diff.toFixed(1)}pp from the month before.`
          : `📉 Adoption dipped ${Math.abs(diff).toFixed(1)}pp last month to ${last.toFixed(1)}%. Worth reviewing with the team.`);
      }
    }
    if (onTarget > 0 && agents.length > 0) {
      const pctOnTarget = Math.round(onTarget/agents.length*100);
      insights.push(pctOnTarget >= 50
        ? `✅ ${pctOnTarget}% of specialists (${onTarget}/${agents.length}) are at or above the ${g.overall}% adoption goal.`
        : `⚠️ Only ${pctOnTarget}% of specialists (${onTarget}/${agents.length}) are hitting the ${g.overall}% goal — coaching opportunity for the rest.`);
    }
    if (coreRate > 0 && omniRate > 0) {
      const leader = coreRate >= omniRate ? 'Cin7 Core' : 'Cin7 Omni';
      const gap    = Math.abs(coreRate - omniRate).toFixed(1);
      insights.push(`🏆 ${leader} is leading adoption by ${gap}pp. Consider sharing what's working across both product teams.`);
    }
    if (avgCsat > 0) {
      insights.push(avgCsat >= g.csat
        ? `⭐ Average CSAT on SnapCall tickets is ${avgCsat.toFixed(2)}/5 — above the ${g.csat}/5 target. Quality is strong.`
        : `💬 Average CSAT of ${avgCsat.toFixed(2)}/5 is below the ${g.csat}/5 target. Review how specialists are framing SnapCall to customers.`);
    }
    if (wmOverall !== null) {
      insights.push(wmOverall >= 60
        ? `🎯 ${wmOverall}% of SnapCall tickets were specialist-initiated — showing strong proactive adoption.`
        : `💡 ${wmOverall}% of SnapCall tickets were specialist-initiated. There's room to grow proactive usage — most are still customer-triggered.`);
    }
    if (top3Snaps.length > 0) {
      const topName = top3Snaps[0].name.split(' ')[0];
      insights.push(`🌟 ${topName} leads the team with ${fmt(top3Snaps[0].snaps)} SnapCall interactions — a great reference point for peer coaching.`);
    }

    // ── SPARKLINE SVG ──
    const sparkW = 700, sparkH = 120;
    let sparkSVG = '<div style="color:#8fadd4;font-size:12px;padding:20px 0;text-align:center">Not enough data for trend</div>';
    if (trendPoints.length > 1) {
      const maxV = Math.max(...trendPoints, g.overall * 1.2, 5);
      const pts  = trendPoints.map((v,i) => {
        const x = (i / (trendPoints.length-1)) * sparkW;
        const y = sparkH - (v/maxV) * sparkH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const goalY = (sparkH - (g.overall/maxV)*sparkH).toFixed(1);
      const fillPts = `0,${sparkH} ${pts} ${sparkW},${sparkH}`;
      sparkSVG = `<svg width="${sparkW}" height="${sparkH}" viewBox="0 0 ${sparkW} ${sparkH}" style="overflow:visible;display:block">
        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#05cbbf" stop-opacity="0.25"/><stop offset="100%" stop-color="#05cbbf" stop-opacity="0"/></linearGradient></defs>
        <polygon points="${fillPts}" fill="url(#sg)"/>
        <line x1="0" y1="${goalY}" x2="${sparkW}" y2="${goalY}" stroke="#f5a623" stroke-width="1.5" stroke-dasharray="8,5"/>
        <polyline points="${pts}" fill="none" stroke="#05cbbf" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${trendPoints.map((v,i) => {
          const x = (i/(trendPoints.length-1))*sparkW;
          const y = sparkH-(v/maxV)*sparkH;
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#05cbbf" stroke="#fff" stroke-width="1.5"/>`;
        }).join('')}
        ${trendPoints.map((v,i) => {
          const x = (i/(trendPoints.length-1))*sparkW;
          const y = sparkH-(v/maxV)*sparkH;
          return `<text x="${x.toFixed(1)}" y="${(y-10).toFixed(1)}" text-anchor="middle" font-size="9" fill="#4a6fa0" font-family="Inter,sans-serif">${v}%</text>`;
        }).join('')}
      </svg>`;
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

    // ── HELPERS ──
    const sc2 = (v,gl) => v >= gl ? '#05cbbf' : v >= gl*0.7 ? '#f5a623' : '#e84545';
    const sl  = (v,gl) => v >= gl ? 'On target' : v >= gl*0.7 ? 'Near target' : 'Below goal';
    const statBar = (val, goal, color) => {
      const w = Math.min(val/Math.max(goal,1)*100, 100).toFixed(0);
      return `<div style="height:5px;background:#e5f0ff;border-radius:3px;margin-top:6px;overflow:hidden"><div style="width:${w}%;height:100%;background:${color};border-radius:3px"></div></div>`;
    };

    progress.textContent = 'Rendering infographic…';

    // ── BUILD HTML ──
    const src = ge('pdf-canvas-source');
    // Portrait width 794px (A4 at 96dpi)
    src.style.width = '794px';
    src.style.padding = '0';
    src.style.background = '#f4f7fb';

    src.innerHTML = `
    <div style="font-family:'Inter',sans-serif;width:794px;background:#f4f7fb;padding:0">

      <!-- HEADER BAND -->
      <div style="background:linear-gradient(135deg,#002e6e 0%,#0a4a9e 100%);padding:36px 44px 32px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;background:rgba(5,203,191,.08)"></div>
        <div style="position:absolute;right:60px;bottom:-60px;width:160px;height:160px;border-radius:50%;background:rgba(5,203,191,.05)"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;position:relative">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:36px;height:36px;background:#05cbbf;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:12px;color:#002e6e">SC</div>
              <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.5)">SnapCall AI</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:6px">Adoption Report</div>
            <div style="font-size:13px;color:rgba(255,255,255,.6)">${org} · ${dateLabel}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Generated</div>
            <div style="font-size:12px;color:rgba(255,255,255,.7)">${exportDate}</div>
            <div style="margin-top:16px;background:rgba(255,255,255,.1);border-radius:8px;padding:10px 14px;text-align:center">
              <div style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#05cbbf;line-height:1">${overallRate.toFixed(1)}%</div>
              <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px">Overall adoption</div>
              <div style="margin-top:6px;display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${sc2(overallRate,g.overall)}22;color:${sc2(overallRate,g.overall)};border:1px solid ${sc2(overallRate,g.overall)}44">${sl(overallRate,g.overall)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:28px 44px">

        <!-- KPI ROW -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
          ${[
            { icon:'🎥', label:'SnapCall Sessions', val: fmt(totalSnaps), sub: `of ${fmt(totalTickets)} tickets`, color:'#05cbbf' },
            { icon:'⭐', label:'Avg CSAT', val: avgCsat > 0 ? avgCsat.toFixed(2)+'/5' : '—', sub: `Target: ${g.csat}/5`, color: avgCsat>0?sc2(avgCsat,g.csat):'#8fadd4' },
            { icon:'⚡', label:'Avg Resolution', val: avgRes > 0 ? avgRes.toFixed(1)+'d' : '—', sub: `Goal: ${g.art} days`, color: avgRes>0?sc2(g.art,avgRes):'#8fadd4' },
            { icon:'🎯', label:'On Target', val: `${onTarget}/${agents.length}`, sub: `at or above ${g.overall}% goal`, color: onTarget/Math.max(agents.length,1) >= 0.5 ? '#05cbbf' : '#f5a623' },
          ].map(k=>`
            <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 8px rgba(0,46,110,.07)">
              <div style="font-size:18px;margin-bottom:8px">${k.icon}</div>
              <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#8fadd4;margin-bottom:4px">${k.label}</div>
              <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:${k.color};line-height:1">${k.val}</div>
              <div style="font-size:10px;color:#4a6fa0;margin-top:4px">${k.sub}</div>
            </div>`).join('')}
        </div>

        <!-- PRODUCT SPLIT -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
          <div style="background:linear-gradient(135deg,rgba(5,203,191,.1),rgba(5,203,191,.03));border:1px solid rgba(5,203,191,.25);border-radius:12px;padding:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#05cbbf">Cin7 Core</div>
                <div style="font-size:11px;color:#4a6fa0;margin-top:2px">${coreAgents.length} specialists</div>
              </div>
              <div style="font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#05cbbf">${ttCore>0?coreRate.toFixed(1)+'%':'—'}</div>
            </div>
            ${statBar(coreRate, g.core, '#05cbbf')}
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#8fadd4;margin-top:5px"><span>${fmt(coreSnaps)} sessions</span><span>Goal: ${g.core}%</span></div>
          </div>
          <div style="background:linear-gradient(135deg,rgba(229,240,255,.8),#fff);border:1px solid rgba(0,46,110,.15);border-radius:12px;padding:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#002e6e">Cin7 Omni</div>
                <div style="font-size:11px;color:#4a6fa0;margin-top:2px">${omniAgents.length} specialists</div>
              </div>
              <div style="font-family:'Syne',sans-serif;font-size:30px;font-weight:800;color:#002e6e">${ttOmni>0?omniRate.toFixed(1)+'%':'—'}</div>
            </div>
            ${statBar(omniRate, g.omni, '#002e6e')}
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#8fadd4;margin-top:5px"><span>${fmt(omniSnaps)} sessions</span><span>Goal: ${g.omni}%</span></div>
          </div>
        </div>

        <!-- TREND CHART -->
        <div style="background:#fff;border-radius:12px;padding:22px;margin-bottom:24px;box-shadow:0 1px 8px rgba(0,46,110,.07)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4">Adoption Trend</div>
            <div style="display:flex;gap:16px">
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#4a6fa0"><div style="width:10px;height:3px;background:#05cbbf;border-radius:2px"></div>Adoption %</div>
              <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#4a6fa0"><div style="width:10px;height:2px;background:#f5a623;border-radius:1px"></div>Goal ${g.overall}%</div>
            </div>
          </div>
          <div style="overflow:hidden">${sparkSVG}</div>
          ${trendPoints.length > 1 ? `<div style="display:flex;justify-content:space-between;font-size:9px;color:#8fadd4;margin-top:6px;padding:0 2px"><span>${monthLabels[0]||''}</span><span>${monthLabels[monthLabels.length-1]||''}</span></div>` : ''}
        </div>

        <!-- INSIGHTS -->
        ${insights.length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:12px">Key Insights</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${insights.map(text => `
              <div style="background:#fff;border-left:3px solid #05cbbf;border-radius:0 10px 10px 0;padding:12px 16px;font-size:12px;color:#002e6e;line-height:1.6;box-shadow:0 1px 6px rgba(0,46,110,.06)">${text}</div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- TOP PERFORMERS -->
        ${top3Snaps.length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:12px">Top Performers</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
            ${top3Snaps.map((a,i) => {
              const medals = ['🥇','🥈','🥉'];
              const colors = ['#05cbbf','#4a6fa0','#c97c3a'];
              const bgs    = ['rgba(5,203,191,.08)','rgba(74,111,160,.06)','rgba(201,124,58,.06)'];
              const firstName = a.name.split(' ')[0];
              const ini = a.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
              return `<div style="background:${bgs[i]};border:1px solid ${colors[i]}33;border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:20px;margin-bottom:8px">${medals[i]}</div>
                <div style="width:40px;height:40px;border-radius:50%;background:${colors[i]};color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">${ini}</div>
                <div style="font-weight:700;color:#002e6e;font-size:13px">${firstName}</div>
                <div style="font-size:10px;color:#4a6fa0;margin:2px 0 8px">${a.product ? 'Cin7 '+a.product : ''}</div>
                <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:${colors[i]}">${fmt(a.snaps)}</div>
                <div style="font-size:9px;color:#8fadd4;margin-bottom:4px">SnapCall sessions</div>
                <div style="font-size:11px;color:#002e6e;font-weight:600">${a.rate.toFixed(1)}% adoption</div>
              </div>`;
            }).join('')}
          </div>
          ${(top3Csat.length > 0 || top3Res.length > 0) ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${top3Csat.length > 0 ? `
            <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 6px rgba(0,46,110,.07)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#f5a623;margin-bottom:10px">⭐ Top CSAT</div>
              ${top3Csat.slice(0,3).map((a,i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:${i<2?'1px solid #f0f4ff':'none'}">
                  <div style="font-size:12px;color:#002e6e;font-weight:${i===0?'600':'400'}">${a.name.split(' ')[0]}</div>
                  <div style="font-size:12px;font-weight:600;color:#f5a623">${a.csat.toFixed(2)}/5</div>
                </div>`).join('')}
            </div>` : ''}
            ${top3Res.length > 0 ? `
            <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 6px rgba(0,46,110,.07)">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#4a6fa0;margin-bottom:10px">⚡ Best Resolution</div>
              ${top3Res.slice(0,3).map((a,i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:${i<2?'1px solid #f0f4ff':'none'}">
                  <div style="font-size:12px;color:#002e6e;font-weight:${i===0?'600':'400'}">${a.name.split(' ')[0]}</div>
                  <div style="font-size:12px;font-weight:600;color:#4a6fa0">${a.avgRes.toFixed(1)}d</div>
                </div>`).join('')}
            </div>` : ''}
          </div>` : ''}
        </div>` : ''}

        <!-- FOOTER -->
        <div style="border-top:1px solid rgba(0,46,110,.1);padding-top:16px;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:10px;color:#8fadd4">SnapCall AI · Part of the Cin7 Quality Framework</div>
          <div style="font-size:10px;color:#8fadd4">${dateLabel} · ${exportDate}</div>
        </div>

      </div>
    </div>`;

    await new Promise(r => setTimeout(r, 500));
    progress.textContent = 'Capturing screenshot…';

    const canvas = await html2canvas(src, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f4f7fb',
      width: 794,
      windowWidth: 794,
      logging: false
    });

    progress.textContent = 'Creating PDF…';
    const { jsPDF } = window.jspdf;
    // Portrait A4
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();   // 210mm
    const pdfH = pdf.internal.pageSize.getHeight();  // 297mm
    const imgData = canvas.toDataURL('image/png');
    const imgH    = (canvas.height / canvas.width) * pdfW;

    if (imgH <= pdfH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
    } else {
      // Multi-page continuous scroll
      let remaining = imgH, page = 0;
      while (remaining > 0) {
        if (page > 0) pdf.addPage();
        const sliceH  = Math.min(pdfH, remaining);
        const srcY    = (page * pdfH / imgH) * canvas.height;
        const srcH    = (sliceH / imgH) * canvas.height;
        const pc      = document.createElement('canvas');
        pc.width = canvas.width; pc.height = Math.ceil(srcH);
        pc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(pc.toDataURL('image/png'), 'PNG', 0, 0, pdfW, sliceH);
        remaining -= pdfH; page++;
      }
    }

    const safeDate = dateLabel.replace(/[^a-zA-Z0-9\-]/g, '_').replace(/__+/g,'_');
    pdf.save(`SnapCall_Report_${safeDate}.pdf`);

  } catch(err) {
    console.error('[PDF Export]', err);
    alert('PDF export failed. Please try again.\n\n' + err.message);
  } finally {
    overlay.style.display = 'none';
    const src = ge('pdf-canvas-source');
    if (src) { src.innerHTML = ''; src.style.width = '1100px'; src.style.padding = '48px 52px 52px'; src.style.background = '#f9f6f3'; }
  }
}
