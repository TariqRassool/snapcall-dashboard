// ── SHARED STATE ──
// Declared at global scope so admin.js, render.js, and pdf.js can all access them.
// main.js loads last, but these variables need to exist when the other scripts run.
let staged        = { sc: null, tt: null, wm: null };
let charts        = {};
let adminUnlocked = false;

document.addEventListener('DOMContentLoaded', function () {

// ── ONE-TIME MIGRATION ──
// Remove stale WM entries that have no months — they came from broken earlier imports
// and corrupt the initiated % calculation.
(function migrateWM() {
  const wm = S.g('wm');
  if (!wm || !wm.length) return;
  const cleaned = wm.filter(a => a.months && a.months.length > 0);
  if (cleaned.length !== wm.length) {
    S.s('wm', cleaned);
    console.log('[SnapCall] Cleaned ' + (wm.length - cleaned.length) + ' stale WM entries with no months');
  }
})();

// ── EVENT BINDINGS ──

// PDF export
ge('btn-pdf-export').addEventListener('click', exportPDF);

// Nav
ge('n-logo').addEventListener('click',     () => goto('overview'));
ge('n-overview').addEventListener('click', () => goto('overview'));
ge('n-agents').addEventListener('click',   () => goto('agents'));
ge('n-teams').addEventListener('click',    () => goto('teams'));
ge('n-channels').addEventListener('click', () => goto('channels'));
ge('n-products').addEventListener('click', () => goto('products'));
ge('n-admin').addEventListener('click',    () => goto('admin'));

// Agent filters
ge('af-prod').addEventListener('change', () => renderAgents());
ge('af-team').addEventListener('change', () => renderAgents());
ge('af-sort').addEventListener('change', () => renderAgents());

// Team filters
ge('tf-prod').addEventListener('change', () => renderTeams());
ge('tf-team').addEventListener('change', () => renderTeams());

// PIN
ge('pin-btn').addEventListener('click', unlockAdmin);
ge('pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') unlockAdmin(); });

// Admin sub-tabs
ge('atp-import').addEventListener('click',   () => atab('import'));
ge('atp-teams').addEventListener('click',    () => atab('teams'));
ge('atp-goals').addEventListener('click',    () => atab('goals'));
ge('atp-settings').addEventListener('click', () => atab('settings'));

// Import drop zones
ge('dz-sc').addEventListener('click', () => ge('f-sc').click());
ge('dz-tt').addEventListener('click', () => ge('f-tt').click());
ge('dz-wm').addEventListener('click', () => ge('f-wm').click());
ge('f-sc').addEventListener('change', e => handleSC(e));
ge('f-tt').addEventListener('change', e => handleTT(e));
ge('f-wm').addEventListener('change', e => handleWM(e));
ge('btn-confirm').addEventListener('click', confirmImport);
ge('btn-cancel').addEventListener('click',  cancelImport);

// Data management buttons
ge('btn-clear').addEventListener('click',     clearAll);
ge('btn-clear-all').addEventListener('click', clearEverything);
ge('btn-clear-wm').addEventListener('click',  clearWM);
ge('btn-export').addEventListener('click',    exportDataJson);

// Goals + Settings
ge('btn-goals').addEventListener('click',    saveGoals);
ge('btn-settings').addEventListener('click', saveSettings);

// Drag & drop on import zones
['dz-sc', 'dz-tt', 'dz-wm'].forEach(id => {
  const dz = ge(id);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (id === 'dz-sc')      handleSC({ target: { files: [f] } });
    else if (id === 'dz-tt') handleTT({ target: { files: [f] } });
    else                     handleWM({ target: { files: [f] } });
  });
});

// ── INIT ──
// Fetch shared data from GitHub, then initialise controls and render.
loadFromGitHub().then(() => {
  initDateRange();
  renderAll();
});

}); // end DOMContentLoaded
