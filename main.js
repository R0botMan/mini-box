// ===== Electron & Node =====
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

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

authApp.get('/callback', async (req, res) => {
  try {
    console.log('[auth] callback hit, code len =', (req.query.code || '').length);
    await exchangeCodeForToken(req.query.code);
    console.log('[auth] access token set?', !!accessToken, 'expires in ~', Math.round((tokenExpiry - Date.now())/1000), 's');
    if (win) win.webContents.send('authed'); // push to renderer
    res.send('<script>window.close()</script><p>Logged in. You can close this window.</p>');
  } catch (e) {
    console.error('[auth] exchange failed:', e);
    res.status(500).send('Auth failed: ' + e.message);
  }
});

authApp.listen(5173, () => console.log('[auth] listening on http://127.0.0.1:5173'));

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

ipcMain.handle('getCurrent', async () => callSpotify('GET', '/me/player/currently-playing?market=from_token'));
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

ipcMain.handle('logout', async () => {
  await clearRefreshToken();
  accessToken = null; refreshToken = null; tokenExpiry = 0;
  if (win) win.webContents.send('loggedOut');
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

async function tryRestore() {
  const stored = await loadRefreshToken();
  if (!stored) { console.log('[auth] no stored refresh token found'); return false; }
  console.log('[auth] found stored refresh token');
  refreshToken = stored;
  try {
    await refresh();                           // sets accessToken + tokenExpiry (may rotate RT)
    console.log('[auth] resumed session via stored refresh token');
    return true;
  } catch (e) {
    console.warn('[auth] stored refresh token failed:', e.message);
    refreshToken = null;
    await clearRefreshToken();
    return false;
  }
}

// ===== Window =====
function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 220,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'assets/MiniBoxIcon2.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
    show: false
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  // win.webContents.openDevTools({ mode: 'detach' }); //optional
}

app.whenReady().then(async () => {
  // try to restore first
  const restored = await tryRestore();

  createWindow();

  // if we were already authed by restore, tell the renderer once it loads
  if (restored || accessToken) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('authed');
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
