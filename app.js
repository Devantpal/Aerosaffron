// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const ADMIN_BOOTSTRAP = {
  uid: 'adminAerosaffronBootstrap',
  email: 'admin@aerosaffron.com',
  password: 'Aerosaffron222',
  name: 'AeroSaffron Admin',
  mobile: '',
  role: 'admin',
  provider: 'local_admin',
  emailVerified: true,
  status: 'active'
};
const ADMIN_BOOTSTRAP_SESSION_KEY = 'aerosaffron_bootstrap_admin_session';

// ===== APP STATE =====
window.AeroApp = {
  sensors: { temperature: 0, humidity: 0, lux: 0, light: 0 },
  controls: { pump: 0, fan: 0, light: 0, peltier: 0 },
  settings: {
    controlMode: "auto",
    tempSet: 23,
    humSet: 65,
    mistDuration: 30,
    mistInterval: 15,
    ledStart: "06:00",
    ledEnd: "22:00",
    fanMin: 24,
    fanMax: 30,
    lightMin: 120,
    lightMax: 350,
    peltierMin: 18,
    peltierMax: 26
  },
  alerts: { msg: "System Normal" },
  device: { online: false, lastSeen: 0, ip: "", heartbeatReceivedAt: 0 },
  tempHistory: [],
  humHistory: [],
  pumpHistory: [],
  rules: [],
  alertLog: [],
  users: [],
  currentUser: null,
  currentProfile: null,
  isAdmin: false,
  isBootstrapAdmin: false,
  usersUnsubscribe: null,
  selectedAdminUserUid: null,
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

// ===== AUTHENTICATION =====
function setAuthMode(mode) {
  const isSignup = mode === 'signup';
  document.querySelectorAll('[data-auth-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.authMode === mode);
  });
  const signupFields = document.getElementById('signup-fields');
  if (signupFields) signupFields.hidden = !isSignup;
  const nameInput = document.getElementById('auth-name');
  const mobileInput = document.getElementById('auth-mobile');
  if (nameInput) nameInput.required = isSignup;
  if (mobileInput) mobileInput.required = isSignup;
  if (!isSignup) {
    if (nameInput) nameInput.value = '';
    if (mobileInput) mobileInput.value = '';
  }
  const password = document.getElementById('auth-password');
  if (password) password.autocomplete = isSignup ? 'new-password' : 'current-password';
  const submit = document.getElementById('auth-submit');
  if (submit) submit.textContent = isSignup ? 'Create account' : 'Sign in';
  const helper = document.getElementById('auth-helper');
  if (helper) helper.textContent = isSignup
    ? 'An activation link will be sent after registration.'
    : 'Use your registered email or continue with Google.';
}
window.setAuthMode = setAuthMode;

function updateAuthUI() {
  const signedIn = Boolean(AeroApp.currentUser);
  document.body.classList.toggle('auth-ready', signedIn);
  document.body.classList.toggle('admin-session', signedIn && AeroApp.isAdmin);
  const authGate = document.getElementById('auth-gate');
  if (authGate) authGate.hidden = signedIn;
  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.hidden = !signedIn;

  const profile = AeroApp.currentProfile || {};
  const name = profile.name || AeroApp.currentUser?.displayName || AeroApp.currentUser?.email || 'User';
  const userName = document.getElementById('user-display-name');
  if (userName) userName.textContent = name;
  const userAvatar = document.getElementById('user-avatar');
  if (userAvatar) userAvatar.textContent = name.trim().charAt(0).toUpperCase() || 'U';
  const verifyBadge = document.getElementById('email-verify-badge');
  if (verifyBadge) {
    const verified = AeroApp.currentUser?.emailVerified === true;
    verifyBadge.textContent = verified ? 'Verified' : 'Verify email';
    verifyBadge.className = `btn btn-outline btn-sm ${verified ? 'badge-on' : 'badge-warning'}`;
  }
  const adminNav = document.getElementById('admin-nav-item');
  if (adminNav) adminNav.hidden = !AeroApp.isAdmin;
}

function subscribeAdminUsers() {
  if (AeroApp.usersUnsubscribe) return;
  AeroApp.usersUnsubscribe = onValue(ref(db, 'aerosaffron/users'), (snap) => {
    const data = snap.val() || {};
    AeroApp.users = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
    renderAdminDashboard();
  }, (err) => {
    console.error(err);
    showToast('Admin user list access denied', 'error');
  });
}

function unsubscribeAdminUsers() {
  if (AeroApp.usersUnsubscribe) {
    AeroApp.usersUnsubscribe();
    AeroApp.usersUnsubscribe = null;
  }
  AeroApp.users = [];
  renderAdminDashboard();
}

async function signInBootstrapAdmin(options = {}) {
  const { silent = false } = options;
  const now = Date.now();
  await update(ref(db, `aerosaffron/users/${ADMIN_BOOTSTRAP.uid}`), {
    name: ADMIN_BOOTSTRAP.name,
    email: ADMIN_BOOTSTRAP.email,
    mobile: ADMIN_BOOTSTRAP.mobile,
    role: ADMIN_BOOTSTRAP.role,
    provider: ADMIN_BOOTSTRAP.provider,
    emailVerified: true,
    status: 'active',
    createdAt: now,
    lastLoginAt: now
  });
  AeroApp.currentUser = {
    uid: ADMIN_BOOTSTRAP.uid,
    email: ADMIN_BOOTSTRAP.email,
    displayName: ADMIN_BOOTSTRAP.name,
    emailVerified: true
  };
  AeroApp.currentProfile = { ...ADMIN_BOOTSTRAP, createdAt: now, lastLoginAt: now };
  AeroApp.isAdmin = true;
  AeroApp.isBootstrapAdmin = true;
  localStorage.setItem(ADMIN_BOOTSTRAP_SESSION_KEY, 'active');
  subscribeAdminUsers();
  updateAuthUI();
  navigateTo('admin');
  if (!silent) showToast('Admin signed in', 'success');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const mode = document.querySelector('[data-auth-mode].active')?.dataset.authMode || 'signin';
  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const name = document.getElementById('auth-name')?.value.trim();
  const mobile = document.getElementById('auth-mobile')?.value.trim();

  if (!email || !password) {
    showToast('Email and password are required', 'warning');
    return;
  }

  try {
    if (mode === 'signup') {
      if (!name || !mobile) {
        showToast('Name and mobile number are required', 'warning');
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await set(ref(db, `aerosaffron/users/${cred.user.uid}`), {
        name,
        email,
        mobile,
        role: 'user',
        provider: 'password',
        emailVerified: false,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        status: 'pending_activation'
      });
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setAuthMode('signin');
      showToast('Account created. Check your email to activate login.', 'success');
    } else {
      if (email.toLowerCase() === ADMIN_BOOTSTRAP.email && password === ADMIN_BOOTSTRAP.password) {
        await signInBootstrapAdmin();
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => {});
        await signOut(auth);
        showToast('Please verify your email before signing in. Activation mail sent again.', 'warning');
        return;
      }
      showToast('Signed in successfully', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Authentication failed', 'error');
  }
}
window.handleAuthSubmit = handleAuthSubmit;

async function signInWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    await user.reload();
    if (!user.emailVerified) {
      await signOut(auth);
      showToast('Please verify your email before signing in.', 'warning');
      return;
    }
    const profileRef = ref(db, `aerosaffron/users/${user.uid}`);
    const existing = (await get(profileRef)).val();
    await update(profileRef, {
      name: user.displayName || 'Google User',
      email: user.email || '',
      mobile: existing?.mobile || '',
      role: existing?.role || 'user',
      provider: 'google',
      emailVerified: user.emailVerified,
      createdAt: existing?.createdAt || Date.now(),
      lastLoginAt: Date.now(),
      status: user.emailVerified ? 'active' : 'pending_activation'
    });
    showToast('Signed in with Google', 'success');
  } catch (err) {
    showToast(err.message || 'Google sign-in failed', 'error');
  }
}
window.signInWithGoogle = signInWithGoogle;

async function forgotPassword() {
  const email = document.getElementById('auth-email')?.value.trim();
  if (!email) {
    showToast('Enter your email first', 'warning');
    return;
  }
  if (email.toLowerCase() === ADMIN_BOOTSTRAP.email) {
    showToast('Bootstrap admin password is managed in project settings', 'info');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Password reset email sent', 'success');
  } catch (err) {
    showToast(err.message || 'Could not send reset email', 'error');
  }
}
window.forgotPassword = forgotPassword;

async function resendActivationMail() {
  if (AeroApp.isBootstrapAdmin) {
    showToast('Bootstrap admin is already active', 'info');
    return;
  }
  if (!auth.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser);
    showToast('Activation email sent again', 'success');
  } catch (err) {
    showToast(err.message || 'Could not send activation email', 'error');
  }
}
window.resendActivationMail = resendActivationMail;

async function logout() {
  if (AeroApp.isBootstrapAdmin) {
    unsubscribeAdminUsers();
    localStorage.removeItem(ADMIN_BOOTSTRAP_SESSION_KEY);
    AeroApp.currentUser = null;
    AeroApp.currentProfile = null;
    AeroApp.isAdmin = false;
    AeroApp.isBootstrapAdmin = false;
    updateAuthUI();
    navigateTo('dashboard');
    showToast('Signed out', 'info');
    return;
  }
  await signOut(auth);
  showToast('Signed out', 'info');
}
window.logout = logout;

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
  if (page === 'admin' && !AeroApp.isAdmin) {
    showToast('Only admin users can access the admin panel', 'warning');
    page = 'dashboard';
  }
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
    alerts: 'System Alerts',
    admin: 'Admin Dashboard'
  };
  const tb = document.querySelector('.topbar-title');
  if (tb) tb.textContent = titles[page] || 'Dashboard';

  // Re-render charts when switching to relevant pages
  if (page === 'dashboard') updateDashboardCharts();
  if (page === 'analytics') updateAnalyticsCharts();
  if (page === 'admin') renderAdminDashboard();
}
window.navigateTo = navigateTo;

// ===== FIREBASE LISTENERS =====
function initFirebase() {
  // Sensors
  onValue(ref(db, 'aerosaffron/sensors'), (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const lux = Number(data.lux ?? data.light ?? 0);
      AeroApp.sensors = { ...AeroApp.sensors, ...data, lux, light: lux };
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
      updateControlModeUI();
    }
  });

  onValue(ref(db, 'aerosaffron/device'), (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const previousLastSeen = AeroApp.device.lastSeen;
      const nextLastSeen = data.lastSeen ?? 0;
      const heartbeatReceivedAt = String(nextLastSeen) !== String(previousLastSeen)
        ? Date.now()
        : AeroApp.device.heartbeatReceivedAt;
      AeroApp.device = { ...AeroApp.device, ...data, heartbeatReceivedAt };
      updateDeviceStatusUI();
    }
  });

  // Alerts
  onValue(ref(db, 'aerosaffron/alerts'), (snap) => {
    if (snap.exists()) {
      AeroApp.alerts = snap.val();
      updateAlertsUI();
    }
  });
  // Automation Rules
onValue(ref(db, 'aerosaffron/automation'), (snap) => {
  if (snap.exists()) {
    const data = snap.val();

    AeroApp.rules = Object.keys(data).map((key, index) => ({
      id: key,
      condition: data[key].condition,
      action: data[key].action,
      active: data[key].status === 1
    }));

    renderRulesTable();
  }
});
}

async function initAuth() {
  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
  setAuthMode('signin');
  if (localStorage.getItem(ADMIN_BOOTSTRAP_SESSION_KEY) === 'active') {
    await signInBootstrapAdmin({ silent: true });
  }

  onAuthStateChanged(auth, async (user) => {
    if (AeroApp.isBootstrapAdmin) return;
    AeroApp.currentUser = user;
    AeroApp.currentProfile = null;
    AeroApp.isAdmin = false;
    unsubscribeAdminUsers();

    if (!user) {
      updateAuthUI();
      return;
    }

    await user.reload();
    if (!auth.currentUser?.emailVerified) {
      await signOut(auth);
      showToast('Please verify your email before signing in.', 'warning');
      return;
    }

    update(ref(db, `aerosaffron/users/${user.uid}`), {
      email: user.email || '',
      name: user.displayName || user.email || 'User',
      emailVerified: user.emailVerified,
      lastLoginAt: Date.now(),
      status: user.emailVerified ? 'active' : 'pending_activation'
    }).catch(() => {});

    onValue(ref(db, `aerosaffron/users/${user.uid}`), (snap) => {
      const profile = snap.val() || {};
      AeroApp.currentProfile = profile;
      AeroApp.isAdmin = profile.role === 'admin';
      if (AeroApp.isAdmin) subscribeAdminUsers();
      else unsubscribeAdminUsers();
      updateAuthUI();
      renderAdminDashboard();
      if (!AeroApp.isAdmin && document.getElementById('page-admin')?.classList.contains('active')) {
        navigateTo('dashboard');
      } else if (AeroApp.isAdmin && document.getElementById('page-dashboard')?.classList.contains('active')) {
        navigateTo('admin');
      }
    });
  });
}

function setConnected(state) {
  AeroApp.connected = state;
  const el = document.getElementById('conn-indicator');
  if (!el) return;
  if (state) {
    el.className = 'conn-indicator';
    el.innerHTML = `<span class="conn-dot"></span>Live`;
  } else {
    el.className = 'conn-indicator disconnected';
    el.innerHTML = `<span class="conn-dot"></span>Offline`;
  }
}

function updateDeviceStatusUI() {
  const now = Date.now();
  const rawLastSeen = Number(AeroApp.device.lastSeen || 0);
  const lastSeen = rawLastSeen > 0 && rawLastSeen < 1000000000000 ? rawLastSeen * 1000 : rawLastSeen;
  const hasUsableLastSeen = lastSeen > 1000000000000;
  const epochFresh = hasUsableLastSeen && lastSeen <= now + 10000 && (now - lastSeen) < 30000;
  const eventFresh = !hasUsableLastSeen && AeroApp.device.heartbeatReceivedAt > 0 && (now - AeroApp.device.heartbeatReceivedAt) < 30000;
  const onlineFlag = AeroApp.device.online === true || AeroApp.device.online === 1 || AeroApp.device.online === 'true';
  const fresh = hasUsableLastSeen ? epochFresh : eventFresh;
  const online = onlineFlag && fresh;
  AeroApp.device.isOnline = online;
  const statusText = online ? 'Device Online' : 'Device Offline';
  const detailText = hasUsableLastSeen
    ? `${online ? 'Last seen' : 'Stale heartbeat'} ${new Date(lastSeen).toLocaleString('en-IN', { hour12: false })}`
    : eventFresh
      ? `Heartbeat received ${new Date(AeroApp.device.heartbeatReceivedAt).toLocaleString('en-IN', { hour12: false })}`
      : 'Waiting for heartbeat';

  const top = document.getElementById('device-status-pill');
  if (top) {
    top.className = `conn-indicator ${online ? '' : 'disconnected'}`;
    top.innerHTML = `<span class="conn-dot"></span>${statusText}`;
  }

  const card = document.getElementById('device-online-card');
  if (card) card.classList.toggle('on-state', online);
  const label = document.getElementById('device-online-text');
  if (label) {
    label.textContent = statusText;
    label.className = `badge ${online ? 'badge-on' : 'badge-off'}`;
  }
  const sub = document.getElementById('device-online-sub');
  if (sub) sub.textContent = detailText;
  updateSensorUI();
  updateControlsUI();
  renderAdminDashboard();
}

// ===== SENSOR UI =====
function updateSensorUI() {
  const s = AeroApp.device.isOnline === true
    ? AeroApp.sensors
    : { temperature: 0, humidity: 0, lux: 0, light: 0 };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setVal('temp-val', `${s.temperature}°C`);
  setVal('hum-val', `${s.humidity}%`);
  setVal('lux-val', `${s.lux} lx`);
  setVal('light-val', `${s.lux} lx`);

  if (AeroApp.device.isOnline !== true) {
    const tempEl = document.getElementById('temp-sub');
    const humEl = document.getElementById('hum-sub');
    const luxEl = document.getElementById('lux-sub');
    if (tempEl) tempEl.textContent = 'Device Offline';
    if (humEl) humEl.textContent = 'Device Offline';
    if (luxEl) luxEl.textContent = 'Device Offline';
    return;
  }

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
  const luxEl = document.getElementById('lux-sub');
  if (luxEl) {
    if (s.lux < AeroApp.settings.lightMin) luxEl.textContent = 'Below minimum';
    else if (s.lux > AeroApp.settings.lightMax) luxEl.textContent = 'Above maximum';
    else luxEl.textContent = 'Target Range';
  }
}

// ===== CONTROLS UI =====
function updateControlsUI() {
  const c = AeroApp.device.isOnline === true
    ? AeroApp.controls
    : { pump: 0, fan: 0, light: 0, peltier: 0 };
  const manualEnabled = AeroApp.settings.controlMode === 'manual' && AeroApp.device.isOnline === true;

  ['pump', 'fan', 'light', 'peltier'].forEach(device => {
    const toggle = document.getElementById(`toggle-${device}`);
    if (toggle) toggle.checked = c[device] === 1;
    if (toggle) toggle.disabled = !manualEnabled;
    const ctrlToggle = document.getElementById(`toggle-${device}-ctrl`);
    if (ctrlToggle) ctrlToggle.checked = c[device] === 1;
    if (ctrlToggle) ctrlToggle.disabled = !manualEnabled;

    const statusEl = document.getElementById(`status-${device}`);
    if (statusEl) {
      statusEl.textContent = AeroApp.device.isOnline === true
        ? c[device] === 1 ? 'Active' : 'Inactive'
        : 'Device Offline';
    }
    const ctrlStatusEl = document.getElementById(`ctrl-status-${device}`);
    if (ctrlStatusEl) {
      ctrlStatusEl.textContent = AeroApp.device.isOnline === true
        ? c[device] === 1 ? 'Active' : 'Inactive'
        : 'Device Offline';
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

function updateControlModeUI() {
  const mode = AeroApp.settings.controlMode || 'auto';
  document.querySelectorAll('[data-control-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.controlMode === mode);
  });
  const manual = mode === 'manual' && AeroApp.device.isOnline === true;
  document.querySelectorAll('.manual-only').forEach(el => {
    el.disabled = !manual;
    el.classList.toggle('disabled', !manual);
  });
  document.querySelectorAll('input[id^="toggle-"]').forEach(el => {
    el.disabled = !manual;
  });
  const modeText = document.getElementById('control-mode-text');
  if (modeText) modeText.textContent = manual ? 'Manual Control' : 'Auto Control';
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
  setInput('inp-fanMin', s.fanMin);
  setInput('inp-fanMax', s.fanMax);
  setInput('inp-lightMin', s.lightMin);
  setInput('inp-lightMax', s.lightMax);
  setInput('inp-peltierMin', s.peltierMin);
  setInput('inp-peltierMax', s.peltierMax);
  updateControlModeUI();
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
    { type: 'INFO', timestamp: '2025-11-15 10:23:45', msg: 'Lux threshold updated' },
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

// ===== ADMIN DASHBOARD =====
function fmtDate(value) {
  const ts = Number(value || 0);
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString('en-IN', { hour12: false });
}

function avgFromHistory(history) {
  const values = history.map(item => Number(item.v)).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function getSelectedAdminUser() {
  if (!AeroApp.selectedAdminUserUid && AeroApp.users.length) {
    AeroApp.selectedAdminUserUid = AeroApp.users[0].uid;
  }
  let user = AeroApp.users.find(item => item.uid === AeroApp.selectedAdminUserUid) || null;
  if (!user && AeroApp.users.length) {
    AeroApp.selectedAdminUserUid = AeroApp.users[0].uid;
    user = AeroApp.users[0];
  }
  return user;
}

function selectAdminUser(uid) {
  if (!AeroApp.isAdmin) return;
  AeroApp.selectedAdminUserUid = uid;
  renderAdminDashboard();
}
window.selectAdminUser = selectAdminUser;

function setUserRole(uid, role) {
  if (!AeroApp.isAdmin) {
    showToast('Only admin users can edit roles', 'warning');
    return;
  }
  if (uid === AeroApp.currentUser?.uid && role !== 'admin') {
    showToast('You cannot remove admin access from your own active session', 'warning');
    renderAdminDashboard();
    return;
  }
  update(ref(db, `aerosaffron/users/${uid}`), { role })
    .then(() => showToast(`User role updated to ${role}`, 'success'))
    .catch(() => showToast('Failed to update role', 'error'));
}
window.setUserRole = setUserRole;

function setUserAccountStatus(uid, status) {
  if (!AeroApp.isAdmin) {
    showToast('Only admin users can manage accounts', 'warning');
    return;
  }
  if (uid === AeroApp.currentUser?.uid && status !== 'active') {
    showToast('You cannot deactivate your own active admin session', 'warning');
    return;
  }
  const active = status === 'active';
  update(ref(db, `aerosaffron/users/${uid}`), {
    status,
    emailVerified: active
  })
    .then(() => showToast(`User marked ${active ? 'active' : 'pending'}`, 'success'))
    .catch(() => showToast('Failed to update account status', 'error'));
}
window.setUserAccountStatus = setUserAccountStatus;

function deleteUserProfile(uid, email) {
  if (!AeroApp.isAdmin) {
    showToast('Only admin users can manage accounts', 'warning');
    return;
  }
  if (uid === AeroApp.currentUser?.uid) {
    showToast('You cannot remove your own active admin account', 'warning');
    return;
  }
  const ok = window.confirm(`Remove ${email || 'this user'} from the dashboard user list?`);
  if (!ok) return;
  set(ref(db, `aerosaffron/users/${uid}`), null)
    .then(() => showToast('User profile removed', 'success'))
    .catch(() => showToast('Failed to remove user profile', 'error'));
}
window.deleteUserProfile = deleteUserProfile;

function saveSelectedUserDetails() {
  const user = getSelectedAdminUser();
  if (!user || !AeroApp.isAdmin) {
    showToast('Select a user first', 'warning');
    return;
  }
  const role = document.getElementById('edit-user-role')?.value || 'user';
  const status = document.getElementById('edit-user-status')?.value || 'pending_activation';
  if (user.uid === AeroApp.currentUser?.uid && (role !== 'admin' || status !== 'active')) {
    showToast('You cannot reduce your own active admin access', 'warning');
    renderAdminDashboard();
    return;
  }
  const payload = {
    name: document.getElementById('edit-user-name')?.value.trim() || 'Unnamed',
    email: document.getElementById('edit-user-email')?.value.trim() || user.email || '',
    mobile: document.getElementById('edit-user-mobile')?.value.trim() || '',
    role,
    status,
    emailVerified: status === 'active'
  };
  update(ref(db, `aerosaffron/users/${user.uid}`), payload)
    .then(() => showToast('User details updated', 'success'))
    .catch(() => showToast('Failed to update user details', 'error'));
}
window.saveSelectedUserDetails = saveSelectedUserDetails;

function sendSelectedUserPasswordReset() {
  const user = getSelectedAdminUser();
  if (!user?.email) {
    showToast('Selected user has no email address', 'warning');
    return;
  }
  if (user.email.toLowerCase() === ADMIN_BOOTSTRAP.email) {
    showToast('Bootstrap admin password is managed in project settings', 'info');
    return;
  }
  sendPasswordResetEmail(auth, user.email)
    .then(() => showToast('Password reset email sent', 'success'))
    .catch(() => showToast('Failed to send password reset email', 'error'));
}
window.sendSelectedUserPasswordReset = sendSelectedUserPasswordReset;

function renderAdminDashboard() {
  if (!document.getElementById('page-admin')) return;
  if (!AeroApp.isAdmin) {
    const tbody = document.getElementById('admin-users-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7">Admin access required.</td></tr>';
    return;
  }
  const online = AeroApp.device.isOnline === true;
  const activeDevices = ['pump', 'fan', 'light', 'peltier'].filter(d => AeroApp.controls[d] === 1).length;
  const activeRules = AeroApp.rules.filter(r => r.active).length;
  const pendingUsers = AeroApp.users.filter(u => u.status === 'pending_activation' || u.emailVerified === false).length;
  const avgTemp = avgFromHistory(AeroApp.tempHistory);
  const avgHum = avgFromHistory(AeroApp.humHistory);
  const selectedUser = getSelectedAdminUser();

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('admin-total-users', AeroApp.users.length);
  setText('admin-user-count-label', `${AeroApp.users.length} users`);
  setText('admin-header-date', `Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
  setText('admin-pending-users', pendingUsers);
  setText('admin-device-state', online ? 'Online' : 'Offline');
  setText('admin-active-devices', activeDevices);
  setText('admin-active-rules', activeRules);
  setText('admin-alert-count', AeroApp.alertLog.length);
  setText('admin-current-temp', online ? `${AeroApp.sensors.temperature} C` : '--');
  setText('admin-current-hum', online ? `${AeroApp.sensors.humidity}%` : '--');
  setText('admin-current-lux', online ? `${AeroApp.sensors.lux} lx` : '--');
  setText('admin-control-mode', AeroApp.settings.controlMode || 'auto');
  setText('admin-mode-summary', AeroApp.settings.controlMode || 'auto');
  setText('admin-avg-temp', avgTemp == null ? '--' : `${avgTemp.toFixed(1)} C`);
  setText('admin-avg-hum', avgHum == null ? '--' : `${avgHum.toFixed(1)}%`);
  setText('admin-sample-count', AeroApp.tempHistory.length);
  setText('admin-latest-alert', AeroApp.alertLog[0]?.msg || AeroApp.alerts.msg || 'System Normal');
  setText('admin-device-ip', AeroApp.device.ip || '--');
  setText('admin-device-last-seen', fmtDate(AeroApp.device.lastSeen));
  setText('admin-mist-schedule', `${AeroApp.settings.mistDuration}s / ${AeroApp.settings.mistInterval}m`);
  setText('admin-led-window', `${AeroApp.settings.ledStart} - ${AeroApp.settings.ledEnd}`);

  const devices = document.getElementById('admin-devices-list');
  if (devices) {
    devices.innerHTML = ['pump', 'fan', 'light', 'peltier'].map(device => {
      const on = AeroApp.controls[device] === 1 && online;
      return `
        <div class="admin-device-row">
          <span>${device.charAt(0).toUpperCase() + device.slice(1)}</span>
          <span class="badge ${on ? 'badge-on' : 'badge-off'}">${on ? 'ON' : 'OFF'}</span>
        </div>
      `;
    }).join('');
  }

  const tbody = document.getElementById('admin-users-tbody');
  if (tbody) {
    tbody.innerHTML = AeroApp.users.map(user => `
      <tr class="${user.uid === AeroApp.selectedAdminUserUid ? 'selected-row' : ''}" onclick="selectAdminUser('${user.uid}')">
        <td>${user.name || 'Unnamed'}</td>
        <td>${user.email || '-'}</td>
        <td>${user.mobile || '-'}</td>
        <td>
          <select class="role-select" onclick="event.stopPropagation()" onchange="setUserRole('${user.uid}', this.value)" ${user.uid === AeroApp.currentUser?.uid ? 'title="Current admin account"' : ''}>
            <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td><span class="badge ${user.emailVerified ? 'badge-on' : 'badge-warning'}">${user.emailVerified ? 'ACTIVE' : 'PENDING'}</span></td>
        <td style="font-family:'DM Mono',monospace;font-size:12px;">${fmtDate(user.lastLoginAt || user.createdAt)}</td>
        <td>
          <div class="account-actions" onclick="event.stopPropagation()">
            <button class="btn-icon manage" onclick="selectAdminUser('${user.uid}')" title="View user details">
              View
            </button>
            <button class="btn-icon manage" onclick="setUserAccountStatus('${user.uid}', '${user.emailVerified ? 'pending_activation' : 'active'}')" title="${user.emailVerified ? 'Deactivate account' : 'Activate account'}">
              ${user.emailVerified ? 'Hold' : 'Activate'}
            </button>
            <button class="btn-icon danger" onclick="deleteUserProfile('${user.uid}', ${JSON.stringify(user.email || '')})" title="Remove user profile">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7">No registered users yet.</td></tr>';
  }

  const empty = document.getElementById('admin-user-empty');
  const detail = document.getElementById('admin-user-detail');
  if (empty) empty.hidden = Boolean(selectedUser);
  if (detail) detail.hidden = !selectedUser;
  if (!selectedUser) return;

  setText('selected-user-name', selectedUser.name || 'Unnamed');
  setText('selected-user-email', selectedUser.email || '-');
  setText('selected-user-mobile', selectedUser.mobile || '-');
  setText('selected-user-status', selectedUser.emailVerified ? 'Active' : 'Pending');
  setText('selected-user-provider', selectedUser.provider || '-');
  setText('selected-user-login', fmtDate(selectedUser.lastLoginAt || selectedUser.createdAt));
  setText('selected-user-avg-temp', avgTemp == null ? '--' : `${avgTemp.toFixed(1)} C`);
  setText('selected-user-avg-hum', avgHum == null ? '--' : `${avgHum.toFixed(1)}%`);
  setText('selected-user-active-relays', activeDevices);
  setText('selected-user-alerts', AeroApp.alertLog.length);
  setText('selected-user-device', online ? 'Online' : 'Offline');
  setText('selected-user-ip', AeroApp.device.ip || '--');
  setText('selected-user-mode', AeroApp.settings.controlMode || 'auto');
  setText('selected-user-light-range', `${AeroApp.settings.lightMin} - ${AeroApp.settings.lightMax} lx`);

  const roleBadge = document.getElementById('selected-user-role');
  if (roleBadge) {
    roleBadge.textContent = (selectedUser.role || 'user').toUpperCase();
    roleBadge.className = `badge ${selectedUser.role === 'admin' ? 'badge-info' : 'badge-off'}`;
  }
  const setInput = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  };
  setInput('edit-user-name', selectedUser.name || '');
  setInput('edit-user-email', selectedUser.email || '');
  setInput('edit-user-mobile', selectedUser.mobile || '');
  setInput('edit-user-role', selectedUser.role || 'user');
  setInput('edit-user-status', selectedUser.emailVerified ? 'active' : (selectedUser.status || 'pending_activation'));
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
  if (!AeroApp.currentUser) {
    showToast('Please sign in first', 'warning');
    updateControlsUI();
    return;
  }
  if (AeroApp.settings.controlMode !== 'manual') {
    showToast('Switch to Manual Control before changing devices', 'warning');
    updateControlsUI();
    return;
  }
  set(ref(db, `aerosaffron/controls/${device}`), value ? 1 : 0)
    .then(() => showToast(`${device.charAt(0).toUpperCase() + device.slice(1)} turned ${value ? 'ON' : 'OFF'}`))
    .catch(() => showToast('Failed to update device', 'error'));
}
window.toggleDevice = toggleDevice;

function setControlMode(mode) {
  if (!AeroApp.currentUser) {
    showToast('Please sign in first', 'warning');
    return;
  }
  const nextMode = mode === 'manual' ? 'manual' : 'auto';
  AeroApp.settings.controlMode = nextMode;
  updateControlModeUI();
  update(ref(db, 'aerosaffron/settings'), { controlMode: nextMode })
    .then(() => update(ref(db, 'aerosaffron/controls'), { _refresh: Date.now() }))
    .then(() => showToast(`${nextMode === 'manual' ? 'Manual' : 'Auto'} control enabled`))
    .catch(() => {
      AeroApp.settings.controlMode = nextMode === 'manual' ? 'auto' : 'manual';
      updateControlModeUI();
      showToast('Failed to update control mode', 'error');
    });
}
window.setControlMode = setControlMode;

// ===== SETTINGS SAVE =====
function saveSettings() {
  if (!AeroApp.currentUser) {
    showToast('Please sign in first', 'warning');
    return;
  }
  const settings = {
    tempSet: parseFloat(document.getElementById('inp-tempSet').value),
    humSet: parseFloat(document.getElementById('inp-humSet').value),
    controlMode: AeroApp.settings.controlMode || 'auto',
    ledStart: document.getElementById('inp-ledStart').value,
    ledEnd: document.getElementById('inp-ledEnd').value,
    mistDuration: parseInt(document.getElementById('inp-mistDuration').value),
    mistInterval: parseInt(document.getElementById('inp-mistInterval').value),
    fanMin: parseFloat(document.getElementById('inp-fanMin').value),
    fanMax: parseFloat(document.getElementById('inp-fanMax').value),
    lightMin: parseInt(document.getElementById('inp-lightMin').value),
    lightMax: parseInt(document.getElementById('inp-lightMax').value),
    peltierMin: parseFloat(document.getElementById('inp-peltierMin').value),
    peltierMax: parseFloat(document.getElementById('inp-peltierMax').value),
  };

  if (settings.fanMin >= settings.fanMax || settings.lightMin >= settings.lightMax || settings.peltierMin >= settings.peltierMax) {
    showToast('Minimum threshold must be lower than maximum', 'warning');
    return;
  }

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
      { id: 3, condition: 'IF lux < 120 lx', action: 'THEN light ON', active: true },
    ];
    
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
          <button class="btn-icon" onclick="toggleRule(${JSON.stringify(rule.id)})" title="Toggle">
            ${rule.active ? '⏸' : '▶'}
          </button>
          <button class="btn-icon" onclick="deleteRule(${JSON.stringify(rule.id)})" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function addRule() {
  if (!AeroApp.currentUser) {
    showToast('Please sign in first', 'warning');
    return;
  }
  const cond = document.getElementById('inp-condition').value.trim();
  const action = document.getElementById('inp-action').value.trim();
  if (!cond || !action) { showToast('Please fill in both fields', 'warning'); return; }

  const ruleRef = ref(db, "aerosaffron/automation");

push(ruleRef, {
  condition: cond,
  action: action,
  status: 1
})
.then(() => {
  showToast("Rule added to Firebase ✅");
  document.getElementById('inp-condition').value = '';
  document.getElementById('inp-action').value = '';
})
.catch(() => showToast("Failed to add rule", "error"));
  document.getElementById('inp-condition').value = '';
  document.getElementById('inp-action').value = '';
  showToast('Rule added successfully');
}
window.addRule = addRule;

function deleteRule(id) {
  set(ref(db, `aerosaffron/automation/${id}`), null)
    .then(() => showToast('Rule deleted from Firebase ✅'))
    .catch(() => showToast('Delete failed', 'error'));
}
window.deleteRule = deleteRule;

 function toggleRule(id) {
  const rule = AeroApp.rules.find(r => r.id === id);
  if (!rule) return;

  update(ref(db, `aerosaffron/automation/${id}`), {
    status: rule.active ? 0 : 1
  });
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
    } else if ((cond.includes('lux') || cond.includes('light')) && cond.includes('<')) {
      const val = parseFloat(cond.match(/[\d.]+/g)?.pop() || 20);
      if (s.lux < val) triggered = true;
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
  initAuth();
  initCharts();
  renderRulesTable();
  renderAlertTable();
  initFirebase();
  setInterval(updateDeviceStatusUI, 5000);
  navigateTo('dashboard');
});
