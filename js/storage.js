// ── STORAGE ──
// All localStorage access goes through S so the key prefix is in one place.
const S = {
  g: k => { try { return JSON.parse(localStorage.getItem('sc9_' + k)); } catch(e) { return null; } },
  s: (k, v) => localStorage.setItem('sc9_' + k, JSON.stringify(v)),
  d: k => localStorage.removeItem('sc9_' + k)
};
const def = (k, fb) => { const v = S.g(k); return v !== null ? v : fb; };
const GOALS = { overall: 20, core: 25, omni: 15, csat: 4, art: 4 };

// ── GITHUB DATA SYNC ──
// Fetches data.json from the same repo on load — populates localStorage for all viewers.
// Admin exports data.json and commits it; everyone else loads it automatically.
async function loadFromGitHub() {
  try {
    const res = await fetch('./data.json?nocache=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    const localTs  = S.g('dataTimestamp') || 0;
    const remoteTs = data.timestamp || 0;
    if (remoteTs > localTs) {
      if (data.sc)          S.s('sc',          data.sc);
      if (data.tt)          S.s('tt',          data.tt);
      if (data.agents)      S.s('agents',      data.agents);
      if (data.goals)       S.s('goals',       data.goals);
      if (data.org)         S.s('org',         data.org);
      if (data.uploadLogs)  S.s('uploadLogs',  data.uploadLogs);
      if (data.wm)          S.s('wm',          data.wm);
      S.s('dataTimestamp', remoteTs);
      console.log('[SnapCall] Loaded data from GitHub data.json (timestamp:', new Date(remoteTs).toLocaleString(), ')');
    }
  } catch(e) {
    console.log('[SnapCall] No data.json found — using local storage');
  }
}

// Export current state as data.json for committing to GitHub
function exportDataJson() {
  const data = {
    timestamp:   Date.now(),
    sc:          S.g('sc')          || [],
    tt:          S.g('tt')          || [],
    wm:          S.g('wm')          || [],
    agents:      S.g('agents')      || [],
    goals:       S.g('goals')       || GOALS,
    org:         S.g('org')         || 'Cin7 Support',
    uploadLogs:  S.g('uploadLogs')  || []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'data.json'; a.click();
  URL.revokeObjectURL(url);
  showN('imp-notif', 'ok', '✓ data.json downloaded — commit this file to your GitHub repo to share with everyone.');
}
