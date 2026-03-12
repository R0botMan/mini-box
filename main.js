// ===== Electron & Node =====
const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ===== Storage =====
const storage = require('./context/storage');
const logger = require('./context/logger');

// ===== Secure storage =====
const keytar = require('keytar');
const SERVICE = 'SpotifyMiniBox'; // keychain service name

// ===== Spotify Auth + Express =====
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const crypto = require('crypto');

// --- Config (set these) ---
const CLIENT_ID   = '8a9573ee7fce499b9663922d2d5ce79e';
const REDIRECT_URI = 'http://127.0.0.1:5173/callback';
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

// Per-client account key for keytar
const ACCOUNT = `refresh:${CLIENT_ID}`;

async function refresh() {
  if (!refreshToken) return;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const j = await r.json();

  // Handle invalid/expired refresh token
  if (j.error) {
    await clearRefreshToken();
    refreshToken = null;
    accessToken  = null;
    tokenExpiry  = 0;
    throw new Error(j.error_description || j.error);
  }

  accessToken = j.access_token;
  tokenExpiry = Date.now() + (j.expires_in - 30) * 1000;

  // Spotify may rotate refresh tokens
  if (j.refresh_token) {
    refreshToken = j.refresh_token;
    await saveRefreshToken(refreshToken);
  }
}

// ===== keytar helpers =====
async function saveRefreshToken(rt) {
  if (!rt) { console.warn('[auth] saveRefreshToken called with empty value'); return; }
  try {
    await keytar.setPassword(SERVICE, ACCOUNT, rt);
    console.log('[auth] refresh token saved (len:', rt.length, ')');
  } catch (e) {
    console.warn('[auth] keytar save failed:', e.message);
  }
}

async function loadRefreshToken() {
  try {
    const v = await keytar.getPassword(SERVICE, ACCOUNT);
    console.log('[auth] keytar load:', v ? `found (len: ${v.length})` : 'none');
    return v;
  } catch (e) {
    console.warn('[auth] keytar load failed:', e.message);
    return null;
  }
}

async function clearRefreshToken() {
  try {
    await keytar.deletePassword(SERVICE, ACCOUNT);
    console.log('[auth] keytar cleared');
  } catch (e) {
    console.warn('[auth] keytar clear failed:', e.message);
  }
}

// ===== PKCE =====
const b64url = buf => buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function newPKCE() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}
let { verifier: CODE_VERIFIER, challenge: CODE_CHALLENGE } = newPKCE();

function authUrl({ forceDialog = false } = {}) {
  const u = new URL('https://accounts.spotify.com/authorize');
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', CODE_CHALLENGE);
  if (forceDialog) u.searchParams.set('show_dialog', 'true'); // <-- important
  return u.toString();
}

// ===== Tokens =====
let accessToken = null;
let refreshToken = null;
let tokenExpiry  = 0; // ms since epoch

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: CODE_VERIFIER
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error_description || j.error);

  accessToken  = j.access_token;
  refreshToken = j.refresh_token || refreshToken; // should be present here
  tokenExpiry  = Date.now() + (j.expires_in - 30) * 1000;

  // persist for future launches
  await saveRefreshToken(refreshToken);
}

async function ensureToken() {
  if (!accessToken || Date.now() > tokenExpiry) await refresh();
}

async function callSpotify(method, url, body) {
  await ensureToken();
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(`https://api.spotify.com/v1${url}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) { // access token expired or revoked
    await refresh();
    return callSpotify(method, url, body);
  }

  if (!res.ok) {
    const errText = await res.text();
    try {
      const errJson = JSON.parse(errText);
      throw new Error(`${res.status} ${res.statusText}: ${errJson.error?.message || errText}`);
    } catch {
      throw new Error(`${res.status} ${res.statusText}: ${errText}`);
    }
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return null;

  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (ct.includes('application/json')) return text ? JSON.parse(text) : null;
  return { ok: true, status: res.status, body: text };
}

// ===== Express redirect server =====
const authApp = express();
authApp.get('/ping', (_req, res) => res.send('pong'));

let win; // forward-declared so we can notify renderer
let queueWin; // queue window
let moreWin; // more menu window
let settingsWin; // settings window

// App state
let appStartTime = Date.now(); // always start fresh for this session
let currentTheme = storage.getTheme(); // load saved theme
let updateStatus = 'idle'; // idle, checking, available, not-available, downloading, ready
let updateInfo = null; // holds update info if available

authApp.get('/callback', async (req, res) => {
  try {
    logger.log('auth', `callback hit, code len = ${(req.query.code || '').length}`);
    await exchangeCodeForToken(req.query.code);
    logger.log('auth', `access token set? ${!!accessToken}, expires in ~ ${Math.round((tokenExpiry - Date.now())/1000)} s`);
    
    // Verify token works by making a test API call
    try {
      await callSpotify('GET', '/me');
      logger.log('auth', 'token verified successfully');
    } catch (verifyErr) {
      logger.log('auth', `token verification failed (may be private session), but token saved: ${verifyErr.message}`);
      // Don't fail - token might be valid but user is in private session or no device active
    }
    
    if (win) win.webContents.send('authed'); // push to renderer
    if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('authed'); // push to more window
    if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('authed'); // push to queue window
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('authed'); // push to settings window
    res.send('<script>window.close()</script><p>Logged in. You can close this window.</p>');
  } catch (e) {
    logger.log('auth', `exchange failed: ${e.message}`);
    res.status(500).send('Auth failed: ' + e.message);
  }
});

authApp.listen(5173, () => logger.log('startup', 'Auth server listening on http://127.0.0.1:5173'));

// ===== IPC =====
ipcMain.handle('login', async () => {
  ({ verifier: CODE_VERIFIER, challenge: CODE_CHALLENGE } = newPKCE());
  const alreadyStored = await loadRefreshToken();        // check keychain
  const url = authUrl({ forceDialog: !alreadyStored });  // force consent only when needed
  console.log('[auth] opening', url);
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('isAuthed', async () => {
  try { await ensureToken(); } catch {}
  return !!accessToken;
});

ipcMain.handle('getCurrent', async () => {
  try {
    if (!accessToken) {
      logger.log('api', 'getCurrent called without authentication');
      return null;
    }
    return await callSpotify('GET', '/me/player/currently-playing?market=from_token');
  } catch (err) {
    logger.log('api', `getCurrent failed: ${err.message}`);
    throw err;
  }
});
ipcMain.handle('playPause', async () => { try { await callSpotify('PUT','/me/player/pause'); } catch { await callSpotify('PUT','/me/player/play'); } });
ipcMain.handle('next', async () => callSpotify('POST','/me/player/next'));
ipcMain.handle('prev', async () => callSpotify('POST','/me/player/previous'));
ipcMain.handle('seek', async (_e, ms) =>
  callSpotify('PUT', `/me/player/seek?position_ms=${Math.round(ms)}`));

ipcMain.handle('getVolume', async () => {
  const state = await callSpotify('GET', '/me/player'); // includes device.volume_percent
  return state?.device?.volume_percent ?? null;          // 0-100 or null if no device
});

// Set volume (0..100)
ipcMain.handle('setVolume', async (_e, pct) => {
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  await callSpotify('PUT', `/me/player/volume?volume_percent=${pct}`);
  return pct;
});

ipcMain.handle('getQueue', async () => {
  try {
    const queue = await callSpotify('GET', '/me/player/queue');
    if (!queue) {
      console.warn('[queue] API returned null - possibly private session or no active device');
      return { queue: [] };
    }
    return queue;
  } catch (err) {
    console.error('[queue] failed to fetch queue:', err.message);
    // Return empty queue instead of throwing error
    return { queue: [] };
  }
});

ipcMain.handle('forceRefresh', async () => {
  logger.log('refresh', 'forced refresh triggered');
  // Broadcast refresh signal to all windows - they'll call getCurrent
  if (win && !win.isDestroyed()) win.webContents.send('forceRefresh');
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('forceRefresh');
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('forceRefresh');
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('forceRefresh');
  return true;
});

ipcMain.handle('getDebugLogPath', async () => {
  return logger.getLogFile();
});

ipcMain.handle('openDebugLog', async () => {
  const logPath = logger.getLogFile();
  await shell.openPath(logPath);
  return logPath;
});

ipcMain.handle('rendererLog', async (_e, category, message) => {
  logger.log(`renderer-${category}`, message);
  return true;
});

ipcMain.handle('clearCache', async () => {
  logger.log('cache', 'clearing all cached data and credentials');
  try {
    // Clear refresh token from keytar
    await clearRefreshToken();
    
    // Clear in-memory tokens
    accessToken = null;
    refreshToken = null;
    tokenExpiry = 0;
    
    // Reset app start time
    storage.resetAppStartTime();
    
    logger.log('cache', 'cache cleared successfully');
    return { success: true, message: 'Cache cleared. Please restart MiniBox.' };
  } catch (err) {
    logger.log('cache', `failed to clear cache: ${err.message}`);
    return { success: false, message: `Failed to clear cache: ${err.message}` };
  }
});

ipcMain.handle('logout', async () => {
  logger.log('auth', 'logout initiated');
  await clearRefreshToken();
  accessToken = null; refreshToken = null; tokenExpiry = 0;
  
  // Close settings window on logout
  if (settingsWin && !settingsWin.isDestroyed()) {
    try {
      settingsWin.close();
    } catch (e) {}
    settingsWin = null;
  }
  
  // Broadcast logout to all windows
  if (win) {
    logger.log('auth', 'sending loggedOut to main window');
    win.webContents.send('loggedOut');
  }
  if (moreWin && !moreWin.isDestroyed()) {
    logger.log('auth', 'sending loggedOut to more window');
    moreWin.webContents.send('loggedOut');
  }
  if (queueWin && !queueWin.isDestroyed()) {
    logger.log('auth', 'sending loggedOut to queue window');
    queueWin.webContents.send('loggedOut');
  }
  logger.log('auth', 'logout complete');
  return true;
});

ipcMain.handle('openSpotifyAccount', async () => {
  await shell.openExternal('https://www.spotify.com/account/');
  return true;
});

ipcMain.handle('closeApp', async () => {
  app.quit();
  return true;
});

ipcMain.handle('restartApp', async () => {
  logger.log('restart', 'restarting app');
  app.relaunch();
  app.quit();
  return true;
});

// ===== App Runtime & Theme =====
ipcMain.handle('getAppRuntime', async () => {
  return storage.getTotalRuntimeWithCurrentSession(appStartTime);
});

ipcMain.handle('setTheme', async (_e, theme) => {
  currentTheme = theme;
  storage.setTheme(theme); // persist theme
  // Broadcast theme change to all windows
  if (win && !win.isDestroyed()) win.webContents.send('themeChanged', theme);
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('themeChanged', theme);
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('themeChanged', theme);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('themeChanged', theme);
  return theme;
});

ipcMain.handle('getTheme', async () => {
  return currentTheme;
});

ipcMain.handle('getVersion', async () => {
  return app.getVersion();
});

ipcMain.handle('getBuildInfo', async () => {
  return `Electron ${process.versions.electron}`;
});

ipcMain.handle('checkForUpdates', async () => {
  updateStatus = 'checking';
  broadcastUpdateStatus();
  
  // Set a timeout in case autoUpdater events never fire
  const timeoutId = setTimeout(() => {
    if (updateStatus === 'checking') {
      updateStatus = 'error';
      broadcastUpdateStatus();
      console.error('[updater] Update check timeout - no response from GitHub');
    }
  }, 15000);
  
  // Trigger the check - completion will be handled by event listeners
  try {
    autoUpdater.checkForUpdates();
    // Clear timeout once we get a response (any event sets updateStatus away from 'checking')
    const checkInterval = setInterval(() => {
      if (updateStatus !== 'checking') {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
      }
    }, 100);
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    updateStatus = 'error';
    broadcastUpdateStatus();
    console.error('[updater] Check trigger failed:', err.message);
    throw err;
  }
});

ipcMain.handle('getUpdateStatus', async () => {
  return { status: updateStatus, info: updateInfo };
});

ipcMain.handle('installUpdate', async () => {
  autoUpdater.quitAndInstall();
});

function broadcastUpdateStatus() {
  if (win && !win.isDestroyed()) win.webContents.send('updateStatusChanged', { status: updateStatus, info: updateInfo });
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('updateStatusChanged', { status: updateStatus, info: updateInfo });
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('updateStatusChanged', { status: updateStatus, info: updateInfo });
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('updateStatusChanged', { status: updateStatus, info: updateInfo });
}

async function tryRestore() {
  const stored = await loadRefreshToken();
  if (!stored) { logger.log('auth', 'no stored refresh token found'); return false; }
  logger.log('auth', 'found stored refresh token');
  refreshToken = stored;
  try {
    await refresh();                           // sets accessToken + tokenExpiry (may rotate RT)
    logger.log('auth', 'resumed session via stored refresh token');
    
    // Verify token works
    try {
      await callSpotify('GET', '/me');
      logger.log('auth', 'restored token verified successfully');
    } catch (verifyErr) {
      logger.log('auth', `token verification failed after restore (may be private session): ${verifyErr.message}`);
      // Don't fail - token might be valid but user is in private session
    }
    
    return true;
  } catch (e) {
    logger.log('auth', `stored refresh token failed: ${e.message}`);
    refreshToken = null;
    await clearRefreshToken();
    return false;
  }
}

// ===== Main Window =====
function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'assets/MiniBoxIcon2.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
      defaultWindowOpenHandler: ({ url }) => {
        // Only allow opening external URLs via shell
        if (url.startsWith('http:') || url.startsWith('https:')) {
          return { action: 'deny' };
        }
        return { action: 'allow' };
      }
    },
    show: false
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  // win.webContents.openDevTools({ mode: 'detach' }); //optional
}

// ===== Queue Window =====
function createQueueWindow() {
  if (queueWin) {
    queueWin.focus();
    return;
  }

  queueWin = new BrowserWindow({
    width: 304,
    height: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    }
  });

  queueWin.loadFile('queue.html');

  // Position queue window above the main player window
  const [x, y] = win.getPosition();
  const queueWidth = 70;
  const queueHeight = 70;
  queueWin.setPosition(x + queueWidth, y - queueHeight - 10);

  // Make queue window follow main window
  const moveHandler = () => {
    try {
      if (queueWin && !queueWin.isDestroyed()) {
        const [newX, newY] = win.getPosition();
        queueWin.setPosition(newX + queueWidth, newY - queueHeight - 10);
      }
    } catch (e) {}
  };
  win.on('move', moveHandler);

  queueWin.once('ready-to-show', () => {
    queueWin.show();
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send('queueOpened');
      }
    } catch (e) {}
  });

  queueWin.on('closed', () => {
    queueWin = null;
    try {
      if (win && !win.isDestroyed()) {
        win.removeListener('move', moveHandler);
        win.webContents.send('queueClosed');
      }
    } catch (e) {}
  });
}

ipcMain.handle('toggleQueue', () => {
  // Close more window if open
  if (moreWin && !moreWin.isDestroyed()) {
    try {
      moreWin.close();
    } catch (e) {}
    moreWin = null;
  }

  // Close settings window if open
  if (settingsWin && !settingsWin.isDestroyed()) {
    try {
      settingsWin.close();
    } catch (e) {}
    settingsWin = null;
  }

  if (queueWin && !queueWin.isDestroyed()) {
    try {
      queueWin.close();
    } catch (e) {}
    queueWin = null;
  } else {
    createQueueWindow();
  }
  return !queueWin;
});

// ===== More Window =====
function createMoreWindow() {
  if (moreWin) {
    moreWin.focus();
    return;
  }

  moreWin = new BrowserWindow({
    width: 304,
    height: 140,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    }
  });

  moreWin.loadFile('more.html');

  // Position more window above the main player window
  const [x, y] = win.getPosition();
  const moreWidth = 230;
  const moreHeight = 80;
  moreWin.setPosition(x + moreWidth, y - moreHeight - 10);

  // Make more window follow main window
  const moveHandler = () => {
    try {
      if (moreWin && !moreWin.isDestroyed()) {
        const [newX, newY] = win.getPosition();
        moreWin.setPosition(newX + moreWidth, newY - moreHeight - 10);
      }
    } catch (e) {}
  };
  win.on('move', moveHandler);

  moreWin.once('ready-to-show', () => {
    moreWin.show();
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send('moreOpened');
      }
    } catch (e) {}
  });

  moreWin.on('closed', () => {
    moreWin = null;
    try {
      if (win && !win.isDestroyed()) {
        win.removeListener('move', moveHandler);
        win.webContents.send('moreClosed');
      }
    } catch (e) {}
  });
}

ipcMain.handle('toggleMore', () => {
  // Close queue window if open
  if (queueWin && !queueWin.isDestroyed()) {
    try {
      queueWin.close();
    } catch (e) {}
    queueWin = null;
  }

  // Close settings window if open
  if (settingsWin && !settingsWin.isDestroyed()) {
    try {
      settingsWin.close();
    } catch (e) {}
    settingsWin = null;
  }

  if (moreWin && !moreWin.isDestroyed()) {
    try {
      moreWin.close();
    } catch (e) {}
    moreWin = null;
  } else {
    createMoreWindow();
  }
  return !moreWin;
});

// ===== Settings Window =====
function createSettingsWindow() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 280,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    }
  });

  settingsWin.loadFile('settings.html');

  // Center settings window relative to main window
  const [x, y] = win.getPosition();
  const [winWidth, winHeight] = win.getSize();
  const settingsWidth = 390;
  const settingsHeight = 510;
  const centeredX = x + (winWidth - settingsWidth) / 2;
  const centeredY = y + (winHeight - settingsHeight) / 2;
  settingsWin.setPosition(Math.round(centeredX), Math.round(centeredY));

  // Make settings window follow main window
  const moveHandler = () => {
    try {
      if (settingsWin && !settingsWin.isDestroyed()) {
        const [newX, newY] = win.getPosition();
        const centeredX = newX + (winWidth - settingsWidth) / 2;
        const centeredY = newY + (winHeight - settingsHeight) / 2;
        settingsWin.setPosition(Math.round(centeredX), Math.round(centeredY));
      }
    } catch (e) {}
  };
  win.on('move', moveHandler);

  settingsWin.once('ready-to-show', () => {
    settingsWin.show();
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send('settingsOpened');
      }
    } catch (e) {}
  });

  settingsWin.on('closed', () => {
    settingsWin = null;
    try {
      if (win && !win.isDestroyed()) {
        win.removeListener('move', moveHandler);
        win.webContents.send('settingsClosed');
      }
    } catch (e) {}
  });
}

ipcMain.handle('toggleSettings', () => {
  // Close queue and more windows if open
  if (queueWin && !queueWin.isDestroyed()) {
    try {
      queueWin.close();
    } catch (e) {}
    queueWin = null;
  }

  if (moreWin && !moreWin.isDestroyed()) {
    try {
      moreWin.close();
    } catch (e) {}
    moreWin = null;
  }

  if (settingsWin && !settingsWin.isDestroyed()) {
    try {
      settingsWin.close();
    } catch (e) {}
    settingsWin = null;
  } else {
    createSettingsWindow();
  }
  return !settingsWin;
});

app.whenReady().then(async () => {
  logger.log('startup', '========== MiniBox App Started ==========');
  logger.log('startup', `Version: ${app.getVersion()}`);
  
  // Set app icon for taskbar and system
  const iconPath = path.join(__dirname, 'assets/MiniBoxIcon2.ico');
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.minibox.spotify');
  }
  try {
    const icon = nativeImage.createFromPath(iconPath);
    app.dock && app.dock.setIcon(icon); // macOS
  } catch (e) {
    console.warn('[icon] Failed to set app icon:', e.message);
  }

  // Setup auto-updater (always setup so handlers work when manually triggered)
  autoUpdater.logger = console;
  
  // Explicitly configure GitHub provider
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'R0botMan',
    repo: 'mini-box'
  });
  
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    updateStatus = 'available';
    updateInfo = info;
    broadcastUpdateStatus();
    logger.log('updater', `Update available: ${info.version} (from ${info.releaseDate})`);
    console.log('[updater] Update available:', info.version);
  });
  
  autoUpdater.on('update-not-available', () => {
    updateStatus = 'not-available';
    updateInfo = null;
    broadcastUpdateStatus();
    logger.log('updater', 'No updates available');
    console.log('[updater] No updates available');
  });
  
  autoUpdater.on('download-progress', (progress) => {
    updateStatus = 'downloading';
    updateInfo = { ...updateInfo, downloadProgress: progress };
    broadcastUpdateStatus();
    logger.log('updater', `Download progress: ${Math.round(progress.percent)}%`);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = 'ready';
    updateInfo = info;
    broadcastUpdateStatus();
    logger.log('updater', `Update downloaded and ready to install: ${info.version}`);
    console.log('[updater] Update downloaded, ready to install');
  });
  
  autoUpdater.on('error', (err) => {
    updateStatus = 'error';
    updateInfo = null;
    broadcastUpdateStatus();
    logger.log('updater', `Error: ${err.message || err}`);
    if (err.stack) {
      logger.log('updater', `Stack: ${err.stack}`);
    }
    console.error('[updater] Error:', err.message || err);
  });
  
  // Auto-check for updates in production mode
  if (process.env.NODE_ENV === 'production' || process.env.FORCE_UPDATER) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // try to restore first
  const restored = await tryRestore();

  createWindow();

  // if we were already authed by restore, tell the renderer once it loads
  if (restored || accessToken) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('authed');
    });
  }

  app.on('before-quit', () => {
    // Save accumulated runtime before closing
    storage.saveTotalRuntime(appStartTime);
    
    // Close all windows before quitting
    if (queueWin && !queueWin.isDestroyed()) {
      try {
        queueWin.close();
      } catch (e) {}
      queueWin = null;
    }
    if (moreWin && !moreWin.isDestroyed()) {
      try {
        moreWin.close();
      } catch (e) {}
      moreWin = null;
    }
    if (settingsWin && !settingsWin.isDestroyed()) {
      try {
        settingsWin.close();
      } catch (e) {}
      settingsWin = null;
    }
    if (win && !win.isDestroyed()) {
      try {
        win.close();
      } catch (e) {}
      win = null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
