// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAtzB7DcXqq0VuER7FTahxDDq7S3Rc-Igc",
  authDomain: "aeroponics-53851.firebaseapp.com",
  databaseURL: "https://aeroponics-53851-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aeroponics-53851",
  storageBucket: "aeroponics-53851.firebasestorage.app",
  messagingSenderId: "263680544758",
  appId: "1:263680544758:web:1c91b5d2fd90021601c1d7",
  measurementId: "G-FQDSVH4CJW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== APP STATE =====
window.AeroApp = {
  sensors: { temperature: 0, humidity: 0, light: 0, waterLevel: 0 },
  controls: { pump: 0, fan: 0, light: 0, peltier: 0 },
  settings: { tempSet: 23, humSet: 65, mistDuration: 30, mistInterval: 15, ledStart: "06:00", ledEnd: "22:00" },
  alerts: { msg: "System Normal" },
  tempHistory: [],
  humHistory: [],
  pumpHistory: [],
  rules: [],
  alertLog: [],
  charts: {},
  connected: false
};

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const tc = document.querySelector('.toast-container');
  if (!tc) return;
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
  t.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
window.showToast = showToast;

// ===== NAVIGATION =====
function initNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    control: 'Device Control',
    automation: 'Automation Rules',
    analytics: 'Data Analytics',
    alerts: 'System Alerts'
  };
  const tb = document.querySelector('.topbar-title');
  if (tb) tb.textContent = titles[page] || 'Dashboard';

  // Re-render charts when switching to relevant pages
  if (page === 'dashboard') updateDashboardCharts();
  if (page === 'analytics') updateAnalyticsCharts();
}
window.navigateTo = navigateTo;

// ===== FIREBASE LISTENERS =====
function initFirebase() {
  // Sensors
  onValue(ref(db, 'aerosaffron/sensors'), (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      AeroApp.sensors = { ...AeroApp.sensors, ...data };
      updateSensorUI();
      recordHistory(data.temperature, data.humidity);
      checkAutomationRules();
    }
    setConnected(true);
  }, (err) => {
    console.error(err);
    setConnected(false);
  });

  // Controls
  onValue(ref(db, 'aerosaffron/controls'), (snap) => {
    if (snap.exists()) {
      AeroApp.controls = { ...AeroApp.controls, ...snap.val() };
      updateControlsUI();
    }
  });

  // Settings
  onValue(ref(db, 'aerosaffron/settings'), (snap) => {
    if (snap.exists()) {
      AeroApp.settings = { ...AeroApp.settings, ...snap.val() };
      updateSettingsUI();
    }
  });

  // Alerts
  onValue(ref(db, 'aerosaffron/alerts'), (snap) => {
    if (snap.exists()) {
      AeroApp.alerts = snap.val();
      updateAlertsUI();
    }
  });
}

function setConnected(state) {
  AeroApp.connected = state;
  const el = document.querySelector('.conn-indicator');
  if (!el) return;
  if (state) {
    el.className = 'conn-indicator';
    el.innerHTML = `<span class="conn-dot"></span>Live`;
  } else {
    el.className = 'conn-indicator disconnected';
    el.innerHTML = `<span class="conn-dot"></span>Offline`;
  }
}

// ===== SENSOR UI =====
function updateSensorUI() {
  const s = AeroApp.sensors;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setVal('temp-val', `${s.temperature}°C`);
  setVal('hum-val', `${s.humidity}%`);
  setVal('water-val', `${s.waterLevel}%`);
  setVal('light-val', `${s.light} lx`);

  // Status hints
  const tempEl = document.getElementById('temp-sub');
  if (tempEl) {
    if (s.temperature > AeroApp.settings.tempSet + 2) tempEl.textContent = '⚠ Above setpoint';
    else if (s.temperature < AeroApp.settings.tempSet - 2) tempEl.textContent = '❄ Below setpoint';
    else tempEl.textContent = 'Optimal Range';
  }
  const humEl = document.getElementById('hum-sub');
  if (humEl) {
    humEl.textContent = s.humidity < AeroApp.settings.humSet ? '⚠ Below setpoint' : 'Normal Level';
  }
  const waterEl = document.getElementById('water-sub');
  if (waterEl) {
    waterEl.textContent = s.waterLevel < 20 ? '🚨 Critically Low' : s.waterLevel < 40 ? '⚠ Low' : 'Tank Capacity';
  }
}

// ===== CONTROLS UI =====
function updateControlsUI() {
  const c = AeroApp.controls;

  ['pump', 'fan', 'light', 'peltier'].forEach(device => {
    const toggle = document.getElementById(`toggle-${device}`);
    if (toggle) toggle.checked = c[device] === 1;

    const statusEl = document.getElementById(`status-${device}`);
    if (statusEl) {
      statusEl.textContent = c[device] === 1 ? 'Active' : 'Inactive';
    }

    // Dashboard device status
    const dashBadge = document.getElementById(`dash-${device}`);
    if (dashBadge) {
      dashBadge.textContent = c[device] === 1 ? 'ON' : 'OFF';
      dashBadge.className = `badge ${c[device] === 1 ? 'badge-on' : 'badge-off'}`;
    }

    const dashCard = document.getElementById(`dash-card-${device}`);
    if (dashCard) {
      dashCard.classList.toggle('on-state', c[device] === 1);
    }
  });
}

// ===== SETTINGS UI =====
function updateSettingsUI() {
  const s = AeroApp.settings;
  const setInput = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setInput('inp-tempSet', s.tempSet);
  setInput('inp-humSet', s.humSet);
  setInput('inp-ledStart', s.ledStart);
  setInput('inp-ledEnd', s.ledEnd);
  setInput('inp-mistDuration', s.mistDuration);
  setInput('inp-mistInterval', s.mistInterval);
}

// ===== ALERTS UI =====
function updateAlertsUI() {
  const msg = AeroApp.alerts.msg || 'System Normal';
  // Add to local alert log if new
  const lastAlert = AeroApp.alertLog[0];
  if (!lastAlert || lastAlert.msg !== msg) {
    const alertType = msg.toLowerCase().includes('critical') || msg.toLowerCase().includes('low') ? 'CRITICAL'
      : msg === 'System Normal' ? 'INFO' : 'WARNING';
    AeroApp.alertLog.unshift({
      msg, type: alertType,
      timestamp: new Date().toLocaleString('en-IN', { hour12: false })
    });
    if (AeroApp.alertLog.length > 50) AeroApp.alertLog.pop();
    renderAlertTable();
  }

  // Badge in topbar
  const alertBadge = document.getElementById('alert-msg-badge');
  if (alertBadge) alertBadge.textContent = msg;
}

function renderAlertTable() {
  const tbody = document.getElementById('alerts-tbody');
  if (!tbody) return;

  // Merge with static demo alerts
  const demoAlerts = [
    { type: 'CRITICAL', timestamp: '2025-11-15 10:23:45', msg: 'Water level critically low (15%)' },
    { type: 'WARNING',  timestamp: '2025-11-15 09:15:22', msg: 'Temperature exceeded threshold (25.5°C)' },
    { type: 'INFO',     timestamp: '2025-11-15 08:00:00', msg: 'LED lights activated automatically' },
    { type: 'WARNING',  timestamp: '2025-11-15 07:45:10', msg: 'Humidity dropped below setpoint (48%)' },
    { type: 'INFO',     timestamp: '2025-11-15 07:30:00', msg: 'Mist cycle completed successfully' },
    { type: 'INFO',     timestamp: '2025-11-15 06:00:00', msg: 'System startup completed' },
    { type: 'CRITICAL', timestamp: '2025-11-14 23:50:15', msg: 'Pump malfunction detected' },
    { type: 'WARNING',  timestamp: '2025-11-14 20:30:00', msg: 'Fan speed reduced due to low temperature' },
  ];

  const all = [...AeroApp.alertLog, ...demoAlerts];
  const typeClass = { CRITICAL: 'badge-critical', WARNING: 'badge-warning', INFO: 'badge-info' };

  tbody.innerHTML = all.map(a => `
    <tr>
      <td class="alert-type-col"><span class="badge ${typeClass[a.type] || 'badge-info'}">${a.type}</span></td>
      <td class="alert-time-col" style="font-family:'DM Mono',monospace;font-size:12.5px;">${a.timestamp}</td>
      <td>${a.msg}</td>
    </tr>
  `).join('');
}

// ===== HISTORY TRACKING =====
const MAX_HISTORY = 30;
function recordHistory(temp, hum) {
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  AeroApp.tempHistory.push({ t: now, v: temp });
  AeroApp.humHistory.push({ t: now, v: hum });
  if (AeroApp.tempHistory.length > MAX_HISTORY) AeroApp.tempHistory.shift();
  if (AeroApp.humHistory.length > MAX_HISTORY) AeroApp.humHistory.shift();
  updateDashboardCharts();
  updateAnalyticsCharts();
}

// ===== CHARTS =====
function initCharts() {
  Chart.defaults.font.family = 'DM Sans';
  Chart.defaults.plugins.legend.labels.boxWidth = 14;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;

  const commonOptions = (yLabel, color) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: '#64748b', font: { size: 12 } } },
      tooltip: { backgroundColor: 'white', titleColor: '#0f172a', bodyColor: '#64748b', borderColor: '#e2e8f0', borderWidth: 1, padding: 10 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 8 } },
      y: {
        grid: { color: '#f1f5f9', drawBorder: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        title: { display: false }
      }
    }
  });

  // Dashboard temp chart
  const dtCtx = document.getElementById('dash-temp-chart');
  if (dtCtx) {
    AeroApp.charts.dashTemp = new Chart(dtCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Temperature (°C)', data: [], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#f97316' }] },
      options: commonOptions('°C', '#f97316')
    });
  }

  // Dashboard hum chart
  const dhCtx = document.getElementById('dash-hum-chart');
  if (dhCtx) {
    AeroApp.charts.dashHum = new Chart(dhCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Humidity (%)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6' }] },
      options: commonOptions('%', '#3b82f6')
    });
  }

  // Analytics charts
  const atCtx = document.getElementById('analytics-temp-chart');
  if (atCtx) {
    AeroApp.charts.anaTemp = new Chart(atCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Average Temperature (°C)', data: [], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f97316' }] },
      options: commonOptions('°C', '#f97316')
    });
  }

  const ahCtx = document.getElementById('analytics-hum-chart');
  if (ahCtx) {
    AeroApp.charts.anaHum = new Chart(ahCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Average Humidity (%)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.06)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6' }] },
      options: commonOptions('%', '#3b82f6')
    });
  }

  // Pump activity bar chart
  const apCtx = document.getElementById('analytics-pump-chart');
  if (apCtx) {
    AeroApp.charts.anaPump = new Chart(apCtx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ label: 'Pump Active (minutes)', data: [45, 60, 30, 75, 55, 40, 65], backgroundColor: 'rgba(22,163,74,0.7)', borderColor: '#16a34a', borderWidth: 1.5, borderRadius: 6 }]
      },
      options: { ...commonOptions('min', '#16a34a'), plugins: { legend: { position: 'top', align: 'end', labels: { color: '#64748b', font: { size: 12 } } } } }
    });
  }

  // Seed with demo data for visual richness
  seedDemoHistory();
}

function seedDemoHistory() {
  const days = ['3/28','3/29','3/30','3/31','4/1','4/2','4/3'];
  const temps = [20, 22.5, 22.8, 22.3, 24.1, 21.9, 21.4];
  const hums  = [61, 65, 66, 65, 68, 61, 61];

  days.forEach((d, i) => {
    AeroApp.tempHistory.push({ t: d, v: temps[i] });
    AeroApp.humHistory.push({ t: d, v: hums[i] });
  });
  updateDashboardCharts();
  updateAnalyticsCharts();
}

function updateDashboardCharts() {
  if (!AeroApp.charts.dashTemp) return;
  const labels = AeroApp.tempHistory.map(h => h.t);
  const temps  = AeroApp.tempHistory.map(h => h.v);
  const hums   = AeroApp.humHistory.map(h => h.v);

  AeroApp.charts.dashTemp.data.labels = labels;
  AeroApp.charts.dashTemp.data.datasets[0].data = temps;
  AeroApp.charts.dashTemp.update('none');

  AeroApp.charts.dashHum.data.labels = labels;
  AeroApp.charts.dashHum.data.datasets[0].data = hums;
  AeroApp.charts.dashHum.update('none');
}

function updateAnalyticsCharts() {
  if (!AeroApp.charts.anaTemp) return;
  const labels = AeroApp.tempHistory.map(h => h.t);
  const temps  = AeroApp.tempHistory.map(h => h.v);
  const hums   = AeroApp.humHistory.map(h => h.v);

  AeroApp.charts.anaTemp.data.labels = labels;
  AeroApp.charts.anaTemp.data.datasets[0].data = temps;
  AeroApp.charts.anaTemp.update('none');

  AeroApp.charts.anaHum.data.labels = labels;
  AeroApp.charts.anaHum.data.datasets[0].data = hums;
  AeroApp.charts.anaHum.update('none');
}

// ===== DEVICE CONTROL =====
function toggleDevice(device, value) {
  set(ref(db, `aerosaffron/controls/${device}`), value ? 1 : 0)
    .then(() => showToast(`${device.charAt(0).toUpperCase() + device.slice(1)} turned ${value ? 'ON' : 'OFF'}`))
    .catch(() => showToast('Failed to update device', 'error'));
}
window.toggleDevice = toggleDevice;

// ===== SETTINGS SAVE =====
function saveSettings() {
  const settings = {
    tempSet: parseFloat(document.getElementById('inp-tempSet').value),
    humSet: parseFloat(document.getElementById('inp-humSet').value),
    ledStart: document.getElementById('inp-ledStart').value,
    ledEnd: document.getElementById('inp-ledEnd').value,
    mistDuration: parseInt(document.getElementById('inp-mistDuration').value),
    mistInterval: parseInt(document.getElementById('inp-mistInterval').value),
  };

  set(ref(db, 'aerosaffron/settings'), settings)
    .then(() => { AeroApp.settings = settings; showToast('Settings Saved ✓'); })
    .catch(() => showToast('Failed to save settings', 'error'));
}
window.saveSettings = saveSettings;

// ===== AUTOMATION RULES =====
function loadLocalRules() {
  const saved = localStorage.getItem('aero_rules');
  if (saved) {
    try { AeroApp.rules = JSON.parse(saved); } catch(e) { AeroApp.rules = []; }
  } else {
    AeroApp.rules = [
      { id: 1, condition: 'IF temperature > 24°C', action: 'THEN cooling ON', active: true },
      { id: 2, condition: 'IF humidity < 50%', action: 'THEN mist pump ON', active: true },
      { id: 3, condition: 'IF water level < 20%', action: 'THEN send alert', active: true },
    ];
    saveLocalRules();
  }
}

function saveLocalRules() {
  localStorage.setItem('aero_rules', JSON.stringify(AeroApp.rules));
}

function renderRulesTable() {
  const tbody = document.getElementById('rules-tbody');
  if (!tbody) return;
  tbody.innerHTML = AeroApp.rules.map(rule => `
    <tr>
      <td>${rule.id}</td>
      <td>${rule.condition}</td>
      <td>${rule.action}</td>
      <td><span class="badge ${rule.active ? 'badge-active' : 'badge-inactive'}">${rule.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn-icon" onclick="toggleRule(${rule.id})" title="Toggle">
            ${rule.active ? '⏸' : '▶'}
          </button>
          <button class="btn-icon" onclick="deleteRule(${rule.id})" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function addRule() {
  const cond = document.getElementById('inp-condition').value.trim();
  const action = document.getElementById('inp-action').value.trim();
  if (!cond || !action) { showToast('Please fill in both fields', 'warning'); return; }

  const maxId = AeroApp.rules.reduce((m, r) => Math.max(m, r.id), 0);
  AeroApp.rules.push({ id: maxId + 1, condition: cond, action, active: true });
  saveLocalRules();
  renderRulesTable();
  document.getElementById('inp-condition').value = '';
  document.getElementById('inp-action').value = '';
  showToast('Rule added successfully');
}
window.addRule = addRule;

function deleteRule(id) {
  AeroApp.rules = AeroApp.rules.filter(r => r.id !== id);
  saveLocalRules();
  renderRulesTable();
  showToast('Rule deleted', 'info');
}
window.deleteRule = deleteRule;

function toggleRule(id) {
  const rule = AeroApp.rules.find(r => r.id === id);
  if (rule) { rule.active = !rule.active; saveLocalRules(); renderRulesTable(); }
}
window.toggleRule = toggleRule;

// ===== AUTOMATION CHECK =====
function checkAutomationRules() {
  const s = AeroApp.sensors;
  const st = AeroApp.settings;
  const activeRules = AeroApp.rules.filter(r => r.active);

  activeRules.forEach(rule => {
    const cond = rule.condition.toLowerCase();
    let triggered = false;

    if (cond.includes('temperature') && cond.includes('>')) {
      const val = parseFloat(cond.match(/[\d.]+/g)?.pop() || 24);
      if (s.temperature > val) triggered = true;
    } else if (cond.includes('humidity') && cond.includes('<')) {
      const val = parseFloat(cond.match(/[\d.]+/g)?.pop() || 50);
      if (s.humidity < val) triggered = true;
    } else if (cond.includes('water') && cond.includes('<')) {
      const val = parseFloat(cond.match(/[\d.]+/g)?.pop() || 20);
      if (s.waterLevel < val) triggered = true;
    }

    if (triggered) {
      const act = rule.action.toLowerCase();
      if (act.includes('cooling') || act.includes('peltier')) {
        if (!AeroApp.controls.peltier) set(ref(db, 'aerosaffron/controls/peltier'), 1);
      } else if (act.includes('pump') || act.includes('mist')) {
        if (!AeroApp.controls.pump) set(ref(db, 'aerosaffron/controls/pump'), 1);
      } else if (act.includes('fan')) {
        if (!AeroApp.controls.fan) set(ref(db, 'aerosaffron/controls/fan'), 1);
      } else if (act.includes('alert')) {
        set(ref(db, 'aerosaffron/alerts/msg'), `Warning: ${rule.condition} triggered!`);
      }
    }
  });
}

// ===== CSV DOWNLOAD =====
function downloadCSV() {
  const rows = [['Timestamp', 'Temperature (°C)', 'Humidity (%)']];
  AeroApp.tempHistory.forEach((h, i) => {
    rows.push([h.t, h.v, AeroApp.humHistory[i]?.v || '']);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aerosaffron_data.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}
window.downloadCSV = downloadCSV;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCharts();
  loadLocalRules();
  renderRulesTable();
  renderAlertTable();
  initFirebase();
  navigateTo('dashboard');
});
