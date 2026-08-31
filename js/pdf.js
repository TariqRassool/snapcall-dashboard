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

    const totalSnaps   = sc.reduce((s, r) => s + (+(r.snaps)||0), 0);
    const totalTickets = tt.reduce((s, r) => s + (+(r.tickets)||0), 0);
    const overallRate  = totalTickets > 0 ? (totalSnaps / totalTickets * 100) : 0;

    const scCore = sc.filter(r => r.product === 'Core');
    const scOmni = sc.filter(r => r.product === 'Omni');
    const ttCore = tt.filter(r => r.product === 'Core');
    const ttOmni = tt.filter(r => r.product === 'Omni');
    const coreSnaps   = scCore.reduce((s,r)=>s+(+(r.snaps)||0),0);
    const coreTickets = ttCore.reduce((s,r)=>s+(+(r.tickets)||0),0);
    const omniSnaps   = scOmni.reduce((s,r)=>s+(+(r.snaps)||0),0);
    const omniTickets = ttOmni.reduce((s,r)=>s+(+(r.tickets)||0),0);
    const coreRate = coreTickets > 0 ? coreSnaps/coreTickets*100 : 0;
    const omniRate = omniTickets > 0 ? omniSnaps/omniTickets*100 : 0;

    const csatAll  = sc.filter(r=>+(r.csat)>0);
    const avgCsat  = csatAll.length > 0 ? csatAll.reduce((s,r)=>s+(+(r.csat)),0)/csatAll.length : 0;
    const resAll   = sc.filter(r=>+(r.resolution)>0);
    const avgRes   = resAll.length > 0 ? resAll.reduce((s,r)=>s+(+(r.resolution)),0)/resAll.length : 0;
    const onTarget = agents.filter(a => a.rate >= g.overall).length;
    const totalAgents = agents.length;

    const top3 = [...agents].sort((a,b)=>b.rate-a.rate).slice(0,3);

    let dateLabel = '';
    if (customRange.from) {
      dateLabel = ymLabel(customRange.from) + ' → ' + ymLabel(customRange.to);
    } else {
      const preset = ge('date-preset').value;
      const optEl  = ge('date-preset').querySelector(`option[value="${preset}"]`);
      dateLabel = optEl ? optEl.textContent : preset;
    }

    const now        = new Date();
    const exportDate = now.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const statusColor = (val, goal) => val >= goal ? '#05cbbf' : val >= goal*0.7 ? '#f5a623' : '#e84545';
    const statusLabel = (val, goal) => val >= goal ? 'On target' : val >= goal*0.7 ? 'Near target' : 'Below goal';
    const pct = (val, goal) => goal > 0 ? Math.round(val/goal*100) : 0;

    const ring = (p, color) => {
      const r = 54, circ = 2*Math.PI*r, dash = Math.min(p/100, 1) * circ;
      return `<svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="#e5f0ff" stroke-width="10"/>
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="${color}" stroke-width="10"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-dashoffset="${(circ/4).toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 65 65)"/>
      </svg>`;
    };

    const trendMonths = sortYM([...new Set([...sc.map(r=>r.month),...tt.map(r=>r.month)])].filter(Boolean));
    const trendPoints = trendMonths.map(m => {
      const s = sc.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.snaps)||0),0);
      const t = tt.filter(r=>r.month===m).reduce((sum,r)=>sum+(+(r.tickets)||0),0);
      return t > 0 ? s/t*100 : 0;
    });

    const sparkW = 580, sparkH = 100;
    let sparkPath = '';
    if (trendPoints.length > 1) {
      const maxV = Math.max(...trendPoints, g.overall * 1.1, 5);
      sparkPath = trendPoints.map((v, i) => {
        const x = (i / (trendPoints.length - 1)) * sparkW;
        const y = sparkH - (v / maxV) * sparkH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    }

    const goalLineY = trendPoints.length > 1
      ? (sparkH - (g.overall / Math.max(...trendPoints, g.overall * 1.1, 5)) * sparkH).toFixed(1)
      : 20;

    const sparkSVG = trendPoints.length > 1 ? `
      <svg width="${sparkW}" height="${sparkH}" viewBox="0 0 ${sparkW} ${sparkH}" style="overflow:visible">
        <line x1="0" y1="${goalLineY}" x2="${sparkW}" y2="${goalLineY}" stroke="#f5a623" stroke-width="1.5" stroke-dasharray="6,4"/>
        <polyline points="${sparkPath}" fill="none" stroke="#05cbbf" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${trendPoints.map((v,i) => {
          const maxV = Math.max(...trendPoints, g.overall * 1.1, 5);
          const x = (i / (trendPoints.length-1)) * sparkW;
          const y = sparkH - (v/maxV)*sparkH;
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#05cbbf"/>`;
        }).join('')}
      </svg>` : '<div style="color:#8fadd4;font-size:12px;padding:20px 0">No trend data for selected range</div>';

    const monthLabels = trendMonths.map(m => ymLabel(m));
    const firstLabel  = monthLabels[0] || '';
    const lastLabel   = monthLabels[monthLabels.length-1] || '';

    progress.textContent = 'Rendering infographic…';

    const src = ge('pdf-canvas-source');
    src.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid rgba(0,46,110,.1)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:#002e6e;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:13px;color:#05cbbf">SC</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#002e6e;line-height:1.1">SnapCall Adoption Report</div>
            <div style="font-size:12px;color:#4a6fa0;margin-top:2px">${org} · ${dateLabel}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#8fadd4;text-transform:uppercase;letter-spacing:.6px">Generated</div>
          <div style="font-size:12px;color:#4a6fa0;font-weight:500">${exportDate}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
        ${[
          { label:'Overall Adoption',  val: overallRate.toFixed(1)+'%',                          goal:'Goal: '+g.overall+'%',    color: statusColor(overallRate, g.overall), badge: statusLabel(overallRate, g.overall) },
          { label:'SnapCall Sessions', val: totalSnaps.toLocaleString(),                          goal:'of '+totalTickets.toLocaleString()+' tickets', color:'#002e6e', badge:null },
          { label:'Avg CSAT',          val: avgCsat > 0 ? avgCsat.toFixed(2)+' / 5' : '—',       goal:'Target: '+g.csat+' / 5',  color: avgCsat>0?statusColor(avgCsat,g.csat):'#8fadd4', badge: avgCsat>0?statusLabel(avgCsat,g.csat):null },
          { label:'Avg Resolution',    val: avgRes  > 0 ? avgRes.toFixed(1)+'d'      : '—',       goal:'Goal: '+g.art+' days',    color: avgRes>0?statusColor(g.art,avgRes):'#8fadd4',   badge: avgRes>0?statusLabel(g.art,avgRes):null },
        ].map(k => `
          <div style="background:#fff;border:1px solid rgba(0,46,110,.09);border-radius:12px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,46,110,.06)">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:8px">${k.label}</div>
            <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:700;letter-spacing:-1px;color:${k.color};line-height:1">${k.val}</div>
            <div style="font-size:11px;color:#4a6fa0;margin-top:5px">${k.goal}</div>
            ${k.badge ? `<div style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;margin-top:6px;background:${k.color}22;color:${k.color}">${k.badge}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px">
        <div style="background:linear-gradient(135deg,rgba(5,203,191,.08),rgba(5,203,191,.02));border:1px solid rgba(5,203,191,.3);border-radius:12px;padding:22px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#05cbbf;margin-bottom:2px">Cin7 Core</div>
          <div style="font-size:11px;color:#4a6fa0;margin-bottom:10px">SnapCall adoption rate</div>
          <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:700;letter-spacing:-1.5px;color:#05cbbf;line-height:1;margin-bottom:4px">${coreRate.toFixed(1)}%</div>
          <div style="display:flex;gap:20px;margin-top:12px">
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Sessions</div><div style="font-size:13px;font-weight:600;color:#002e6e">${coreSnaps.toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Tickets</div><div style="font-size:13px;font-weight:600;color:#002e6e">${coreTickets.toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Goal</div><div style="font-size:13px;font-weight:600;color:#002e6e">${g.core}%</div></div>
          </div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(229,240,255,.8),#fff);border:1px solid rgba(0,46,110,.15);border-radius:12px;padding:22px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#002e6e;margin-bottom:2px">Cin7 Omni</div>
          <div style="font-size:11px;color:#4a6fa0;margin-bottom:10px">SnapCall adoption rate</div>
          <div style="font-family:'Syne',sans-serif;font-size:36px;font-weight:700;letter-spacing:-1.5px;color:#002e6e;line-height:1;margin-bottom:4px">${omniRate.toFixed(1)}%</div>
          <div style="display:flex;gap:20px;margin-top:12px">
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Sessions</div><div style="font-size:13px;font-weight:600;color:#002e6e">${omniSnaps.toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Tickets</div><div style="font-size:13px;font-weight:600;color:#002e6e">${omniTickets.toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:#8fadd4;text-transform:uppercase;letter-spacing:.4px">Goal</div><div style="font-size:13px;font-weight:600;color:#002e6e">${g.omni}%</div></div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:220px 1fr;gap:14px;margin-bottom:28px">
        <div style="background:#fff;border:1px solid rgba(0,46,110,.09);border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,46,110,.06);text-align:center">
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:12px">Goal Progress</div>
          <div style="display:flex;justify-content:center;position:relative">
            ${ring(pct(overallRate, g.overall), statusColor(overallRate, g.overall))}
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
              <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#002e6e">${overallRate.toFixed(1)}%</div>
              <div style="font-size:10px;color:#8fadd4">of ${g.overall}% goal</div>
            </div>
          </div>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:#4a6fa0">Cin7 Core</span><strong style="color:#05cbbf">${coreRate.toFixed(1)}%</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:#4a6fa0">Cin7 Omni</span><strong style="color:#002e6e">${omniRate.toFixed(1)}%</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:#4a6fa0">On target</span><strong style="color:#002e6e">${onTarget} / ${totalAgents}</strong></div>
          </div>
        </div>
        <div style="background:#fff;border:1px solid rgba(0,46,110,.09);border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,46,110,.06)">
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:4px">Adoption Trend</div>
          <div style="display:flex;gap:14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#4a6fa0"><div style="width:8px;height:8px;border-radius:2px;background:#05cbbf"></div>Overall %</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#4a6fa0"><div style="width:8px;height:2px;background:#f5a623;margin-top:1px"></div>Goal ${g.overall}%</div>
          </div>
          <div style="padding:4px 0 8px">${sparkSVG}</div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#8fadd4;margin-top:2px"><span>${firstLabel}</span><span>${lastLabel}</span></div>
        </div>
      </div>

      ${top3.length > 0 ? `
      <div style="background:#fff;border:1px solid rgba(0,46,110,.09);border-radius:12px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,46,110,.06);margin-bottom:28px">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#8fadd4;margin-bottom:16px">Top Performers — Adoption Rate</div>
        <div style="display:flex;gap:14px">
          ${top3.map((a, i) => {
            const medals = ['🥇','🥈','🥉'];
            const colors = ['#fbbf24','#94a3b8','#c97c3a'];
            return `<div style="flex:1;background:${i===0?'linear-gradient(135deg,#fffdf0,#fff)':'#fafcff'};border:1px solid ${colors[i]}44;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:20px;margin-bottom:6px">${medals[i]}</div>
              <div style="font-size:13px;font-weight:700;color:#002e6e;margin-bottom:2px">${a.name}</div>
              <div style="font-size:10px;color:#4a6fa0;margin-bottom:10px">${a.product ? 'Cin7 '+a.product : ''}</div>
              <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:${colors[i]}">${a.rate.toFixed(1)}%</div>
              <div style="font-size:10px;color:#8fadd4">adoption rate</div>
              <div style="display:flex;justify-content:center;gap:10px;margin-top:10px">
                <div><div style="font-size:11px;font-weight:600;color:#002e6e">${a.snaps}</div><div style="font-size:9px;color:#8fadd4">sessions</div></div>
                ${a.csat>0?`<div><div style="font-size:11px;font-weight:600;color:#002e6e">${a.csat.toFixed(1)}</div><div style="font-size:9px;color:#8fadd4">CSAT</div></div>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <div style="border-top:1px solid rgba(0,46,110,.1);padding-top:14px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;color:#8fadd4">SnapCall AI · Part of the Cin7 Quality Framework</div>
        <div style="font-size:11px;color:#8fadd4">${dateLabel} · ${exportDate}</div>
      </div>
    `;

    await new Promise(r => setTimeout(r, 400));
    progress.textContent = 'Capturing screenshot…';

    const canvas = await html2canvas(src, {
      scale: 2, useCORS: true, backgroundColor: '#f9f6f3',
      width: 1100, windowWidth: 1100, logging: false
    });

    progress.textContent = 'Creating PDF…';
    const { jsPDF } = window.jspdf;
    const pdf  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png');
    const imgH    = (canvas.height / canvas.width) * pdfW;

    if (imgH <= pdfH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
    } else {
      let remaining = imgH, page = 0;
      while (remaining > 0) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(pdfH, remaining);
        const srcY   = (page * pdfH / imgH) * canvas.height;
        const srcH   = (sliceH / imgH) * canvas.height;
        const pc = document.createElement('canvas');
        pc.width = canvas.width; pc.height = srcH;
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
    if (src) src.innerHTML = '';
  }
}
