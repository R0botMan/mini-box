// ===== Electron & Node =====
const { app, BrowserWindow, ipcMain, shell, nativeImage, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
const { parseFile } = require('music-metadata');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ===== Storage =====
const storage = require('../context/storage');
const logger = require('../context/logger');
const registerQueueWindow = require('./queue');
const registerMoreWindow = require('./more');
const registerSettingsWindow = require('./settings');
const registerLocalWindow = require('./local');
const registerPatchWindow = require('./patch');

// ===== Secure storage =====
const keytar = require('keytar');
const SERVICE = 'SpotifyMiniBox'; // keychain service name

// ===== Spotify Auth + Express =====
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const crypto = require('crypto');

// --- Config (set these) ---
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
if (!CLIENT_ID) {
  throw new Error('Missing SPOTIFY_CLIENT_ID in .env');
}
const AUTH_PORT = Number.parseInt(process.env.MINIBOX_AUTH_PORT || '5173', 10);
const AUTH_HOST = '127.0.0.1';
const REDIRECT_URI = `http://${AUTH_HOST}:${AUTH_PORT}/callback`;
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

// Per-client account key for keytar
const ACCOUNT = `refresh:${CLIENT_ID}`;
const AUDIO_FILE_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac']);

function normalizeAndDedupePaths(paths = []) {
  return [...new Set(
    paths
      .filter(Boolean)
      .map(filePath => path.normalize(filePath))
  )];
}

function normalizeLocalAudioSources(sources = {}) {
  return {
    files: normalizeAndDedupePaths(sources.files || []).filter(filePath =>
      AUDIO_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
    ),
    folders: normalizeAndDedupePaths(sources.folders || [])
  };
}

function normalizeLocalAudioSourceEntry(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const type = source.type === 'file' || source.type === 'folder' ? source.type : null;
  const sourcePath = typeof source.path === 'string' ? path.normalize(source.path) : '';

  if (!type || !sourcePath) {
    return null;
  }

  if (type === 'file' && !AUDIO_FILE_EXTENSIONS.has(path.extname(sourcePath).toLowerCase())) {
    return null;
  }

  return {
    type,
    path: sourcePath
  };
}

function isLocalAudioSourcePresent(source, sources = getLocalAudioSources()) {
  if (!source) {
    return false;
  }

  const collection = source.type === 'file' ? sources.files : sources.folders;
  return collection.includes(source.path);
}

function sameLocalAudioSource(left, right) {
  return !!left && !!right && left.type === right.type && left.path === right.path;
}

function getFirstAvailableLocalAudioSource(sources = getLocalAudioSources()) {
  if (sources.files.length) {
    return {
      type: 'file',
      path: sources.files[0]
    };
  }

  if (sources.folders.length) {
    return {
      type: 'folder',
      path: sources.folders[0]
    };
  }

  return null;
}

function getLocalSourceItems(sources = getLocalAudioSources()) {
  const fileItems = sources.files.map(filePath => ({
    id: `file:${filePath}`,
    type: 'file',
    path: filePath,
    name: path.basename(filePath) || filePath,
    detail: filePath
  }));

  const folderItems = sources.folders.map(folderPath => ({
    id: `folder:${folderPath}`,
    type: 'folder',
    path: folderPath,
    name: path.basename(folderPath) || folderPath,
    detail: folderPath
  }));

  return [...fileItems, ...folderItems];
}

function getLocalImportCount(sources = getLocalAudioSources()) {
  return getLocalSourceItems(sources).length;
}

function getLocalAudioSources() {
  return normalizeLocalAudioSources(storage.getLocalAudioSources());
}

function getActiveLocalAudioSource() {
  const activeSource = normalizeLocalAudioSourceEntry(storage.getActiveLocalAudioSource());
  if (!activeSource) {
    return null;
  }

  return isLocalAudioSourcePresent(activeSource) ? activeSource : null;
}

function setActiveLocalAudioSource(source) {
  const normalizedSource = normalizeLocalAudioSourceEntry(source);
  if (normalizedSource && !isLocalAudioSourcePresent(normalizedSource)) {
    throw new Error('Selected local source is no longer imported');
  }

  storage.setActiveLocalAudioSource(normalizedSource);
  return normalizedSource;
}

function setLocalAudioSources(sources) {
  const normalizedSources = normalizeLocalAudioSources(sources);
  storage.setLocalAudioSources(normalizedSources);
  return normalizedSources;
}

function syncActiveLocalAudioSource(sources = getLocalAudioSources()) {
  const activeSource = normalizeLocalAudioSourceEntry(storage.getActiveLocalAudioSource());
  if (activeSource && isLocalAudioSourcePresent(activeSource, sources)) {
    return activeSource;
  }

  storage.setActiveLocalAudioSource(null);
  return null;
}

function invalidateLocalAudioLibraryCache() {
  localAudioLibraryCache.signature = null;
}

function createDefaultLocalTrack(filePath) {
  const fileName = path.basename(filePath);
  const trackName = fileName.replace(/\.[^.]+$/, '') || fileName;
  return {
    id: `local:${filePath}`,
    name: trackName,
    artists: [{ name: 'Local File' }],
    album: { images: [] },
    duration_ms: 0,
    localPath: filePath,
    localUrl: pathToFileURL(filePath).toString()
  };
}

function pictureToDataUrl(picture) {
  if (!picture?.data || !picture?.format) {
    return '';
  }
  return `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
}

async function collectAudioFilesFromFolder(folderPath, results = []) {
  let entries = [];

  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch (err) {
    logger.log('local-audio', `Failed to read folder ${folderPath}: ${err.message}`);
    return results;
  }

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      await collectAudioFilesFromFolder(entryPath, results);
      continue;
    }

    if (entry.isFile() && AUDIO_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(path.normalize(entryPath));
    }
  }

  return results;
}

async function buildLocalTrack(filePath) {
  const fallbackTrack = createDefaultLocalTrack(filePath);

  try {
    const metadata = await parseFile(filePath, { duration: true, skipPostHeaders: true });
    const title = metadata.common.title || fallbackTrack.name;
    const artist = metadata.common.artist || metadata.common.albumartist || 'Local File';
    const picture = metadata.common.picture?.[0];
    const artworkUrl = pictureToDataUrl(picture);

    return {
      ...fallbackTrack,
      name: title,
      artists: [{ name: artist }],
      album: {
        images: artworkUrl ? [{ url: artworkUrl }] : []
      },
      duration_ms: Math.round((metadata.format.duration || 0) * 1000)
    };
  } catch (err) {
    logger.log('local-audio', `Metadata parse failed for ${filePath}: ${err.message}`);
    return fallbackTrack;
  }
}

async function collectAudioFilesForSource(source) {
  if (!source) {
    return [];
  }

  if (source.type === 'file') {
    return getLocalAudioSources().files;
  }

  return collectAudioFilesFromFolder(source.path, []);
}

let localAudioLibraryCache = {
  signature: null,
  tracks: []
};

let localPlaybackState = {
  current: null,
  queue: [],
  is_playing: false,
  progress_ms: 0,
  volume: 100
};

function normalizeLocalPlaybackState(state = {}) {
  return {
    current: state.current || null,
    queue: Array.isArray(state.queue) ? state.queue : [],
    is_playing: !!state.is_playing,
    progress_ms: Number.isFinite(state.progress_ms) ? state.progress_ms : 0,
    volume: Number.isFinite(state.volume) ? state.volume : 100
  };
}

function clearLocalPlaybackState() {
  localPlaybackState = normalizeLocalPlaybackState({
    current: null,
    queue: [],
    is_playing: false,
    progress_ms: 0,
    volume: localPlaybackState.volume
  });

  broadcastLocalPlaybackStateChanged(localPlaybackState);
}

async function getLocalAudioLibrary(source = getActiveLocalAudioSource()) {
  const normalizedSource = normalizeLocalAudioSourceEntry(source);
  const sources = getLocalAudioSources();
  const activeSource = normalizedSource && isLocalAudioSourcePresent(normalizedSource, sources)
    ? normalizedSource
    : null;
  const signature = JSON.stringify({ sources, activeSource });
  if (localAudioLibraryCache.signature === signature) {
    return localAudioLibraryCache.tracks;
  }

  const allFiles = activeSource
    ? normalizeAndDedupePaths(await collectAudioFilesForSource(activeSource)).filter(filePath =>
        AUDIO_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
      )
    : [];

  const tracks = [];
  for (const filePath of allFiles) {
    tracks.push(await buildLocalTrack(filePath));
  }

  localAudioLibraryCache = {
    signature,
    tracks
  };

  return tracks;
}

function broadcastLocalAudioSourcesChanged(sources) {
  if (win && !win.isDestroyed()) win.webContents.send('localAudioSourcesChanged', sources);
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('localAudioSourcesChanged', sources);
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('localAudioSourcesChanged', sources);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('localAudioSourcesChanged', sources);
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('localAudioSourcesChanged', sources);
  applyLocalWindowLayout();
}

function broadcastLocalActiveSourceChanged(payload) {
  if (win && !win.isDestroyed()) win.webContents.send('localActiveSourceChanged', payload);
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('localActiveSourceChanged', payload);
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('localActiveSourceChanged', payload);
}

function broadcastLocalPlaybackStateChanged(state) {
  if (win && !win.isDestroyed()) win.webContents.send('localPlaybackStateChanged', state);
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('localPlaybackStateChanged', state);
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('localPlaybackStateChanged', state);
}

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
    const err = createSpotifyAuthError(j, r.status);
    if (isInvalidGrantAuthError(err)) {
      await clearRefreshToken();
      refreshToken = null;
      accessToken  = null;
      tokenExpiry  = 0;
    }
    throw err;
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

function newPendingSpotifyAuth() {
  const { verifier, challenge } = newPKCE();
  return {
    verifier,
    challenge,
    state: b64url(crypto.randomBytes(16)),
    createdAt: Date.now()
  };
}

function getPendingSpotifyAuth() {
  return storage.getPendingSpotifyAuth();
}

function setPendingSpotifyAuth(auth) {
  storage.setPendingSpotifyAuth(auth);
  return storage.getPendingSpotifyAuth();
}

function clearPendingSpotifyAuth() {
  storage.setPendingSpotifyAuth(null);
}

function createSpotifyAuthError(payload, status = 0) {
  const err = new Error(payload?.error_description || payload?.error || 'Spotify auth failed');
  err.spotifyError = payload?.error || null;
  err.status = status;
  return err;
}

function isInvalidGrantAuthError(err) {
  if (!err) {
    return false;
  }

  const message = String(err.message || '').toLowerCase();
  return err.spotifyError === 'invalid_grant'
    || message.includes('invalid_grant')
    || message.includes('refresh token revoked')
    || message.includes('refresh token is invalid')
    || message.includes('code_verifier')
    || message.includes('code verifier');
}

function authUrl({ forceDialog = false, authSession = getPendingSpotifyAuth() } = {}) {
  if (!authSession) {
    throw new Error('No pending Spotify auth session');
  }

  const u = new URL('https://accounts.spotify.com/authorize');
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', authSession.challenge);
  u.searchParams.set('state', authSession.state);
  if (forceDialog) u.searchParams.set('show_dialog', 'true'); // <-- important
  return u.toString();
}

// ===== Tokens =====
let accessToken = null;
let refreshToken = null;
let tokenExpiry  = 0; // ms since epoch

async function exchangeCodeForToken(code, state) {
  const pendingAuth = getPendingSpotifyAuth();
  if (!pendingAuth) {
    throw new Error('Login session expired. Please try again.');
  }

  if (!state || state !== pendingAuth.state) {
    throw new Error('Stale Spotify login callback ignored. Please use the newest login window.');
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: pendingAuth.verifier
  });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const j = await r.json();
  if (j.error) {
    const err = createSpotifyAuthError(j, r.status);
    if (isInvalidGrantAuthError(err)) {
      clearPendingSpotifyAuth();
    }
    throw err;
  }

  accessToken  = j.access_token;
  refreshToken = j.refresh_token || refreshToken; // should be present here
  tokenExpiry  = Date.now() + (j.expires_in - 30) * 1000;

  // persist for future launches
  await saveRefreshToken(refreshToken);
  clearPendingSpotifyAuth();
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
let localWin; // local audio window
let patchWin; // patch notes window

// App state
let appStartTime = Date.now(); // always start fresh for this session
let currentTheme = storage.getTheme(); // load saved theme
let currentSourceMode = storage.getSourceMode(); //load saved playback source 
let updateStatus = 'idle'; // idle, checking, available, not-available, downloading, ready
let updateInfo = null; // holds update info if available

authApp.get('/callback', async (req, res) => {
  try {
    if (req.query.error) {
      throw new Error(req.query.error_description || req.query.error);
    }

    logger.log('auth', `callback hit, code len = ${(req.query.code || '').length}`);
    await exchangeCodeForToken(req.query.code, req.query.state);
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
    if (localWin && !localWin.isDestroyed()) localWin.webContents.send('authed'); // push to local window
    res.set('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MiniBox Login Complete</title>
    <style>
      :root {
        color-scheme: dark;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #2d8f6f 0%, #121212 52%, #090909 100%);
        color: #f7f7f7;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }

      main {
        width: min(440px, calc(100vw - 32px));
        padding: 28px 24px;
        border-radius: 18px;
        background: rgba(12, 18, 16, 0.9);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
      }

      h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }

      p {
        margin: 0;
        line-height: 1.5;
        color: rgba(247, 247, 247, 0.82);
      }

      .meta {
        margin-top: 16px;
        font-size: 13px;
        color: rgba(247, 247, 247, 0.65);
      }

      .actions {
        margin-top: 18px;
        display: flex;
        gap: 12px;
        align-items: center;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        background: #f7f7f7;
        color: #101010;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>MiniBox login complete</h1>
      <p>You can return to MiniBox now. This tab will stay open for a few seconds so you can confirm the login finished correctly.</p>
      <p class="meta" id="status">This tab will try to close automatically in 30 seconds.</p>
      <div class="actions">
        <button id="closeBtn" type="button">Close Now</button>
      </div>
    </main>
    <script>
      const status = document.getElementById('status');
      const closeBtn = document.getElementById('closeBtn');
      let secondsRemaining = 30;

      closeBtn.addEventListener('click', () => {
        window.close();
      });

      const intervalId = setInterval(() => {
        secondsRemaining -= 1;
        if (secondsRemaining <= 0) {
          clearInterval(intervalId);
          status.textContent = 'Closing...';
          window.close();
          return;
        }

        status.textContent = 'This tab will try to close automatically in ' + secondsRemaining + ' seconds.';
      }, 1000);
    </script>
  </body>
</html>`);
  } catch (e) {
    logger.log('auth', `exchange failed: ${e.message}`);
    res.status(500).send('Auth failed: ' + e.message);
  }
});

// Don't start server here - it will start when app is ready
let authServer = null;
let authServerReady = false;
let authServerStartPromise = null;

function getAuthServerBaseUrl() {
  return `http://${AUTH_HOST}:${AUTH_PORT}`;
}

function startAuthServer() {
  if (authServer && authServerReady) {
    return Promise.resolve(authServer);
  }

  if (authServerStartPromise) {
    return authServerStartPromise;
  }

  authServerStartPromise = new Promise((resolve, reject) => {
    const server = authApp.listen(AUTH_PORT, AUTH_HOST);

    const handleListening = () => {
      server.removeListener('error', handleError);
      authServer = server;
      authServerReady = true;
      authServerStartPromise = null;
      logger.log('startup', `Auth server listening on ${getAuthServerBaseUrl()}`);
      resolve(server);
    };

    const handleError = (err) => {
      server.removeListener('listening', handleListening);
      authServer = null;
      authServerReady = false;
      authServerStartPromise = null;
      reject(err);
    };

    server.once('listening', handleListening);
    server.once('error', handleError);
    server.once('close', () => {
      if (authServer === server) {
        authServer = null;
      }
      authServerReady = false;
    });
  });

  return authServerStartPromise;
}

// ===== IPC =====
ipcMain.handle('login', async () => {
  try {
    await startAuthServer();
  } catch (err) {
    const message = `MiniBox could not start its local login server on ${AUTH_HOST}:${AUTH_PORT}. Another app may already be using that port.`;
    logger.log('auth', `login blocked: ${err.message}`);
    dialog.showErrorBox('MiniBox Login Error', `${message}\n\nDetails: ${err.message}`);
    return false;
  }

  const authSession = setPendingSpotifyAuth(newPendingSpotifyAuth());
  const alreadyStored = await loadRefreshToken();        // check keychain
  const url = authUrl({ forceDialog: !alreadyStored, authSession });  // force consent only when needed
  console.log('[auth] opening', url);
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('isAuthed', async () => {
  try { await ensureToken(); } catch {}
  return !!accessToken;
});

ipcMain.handle('getCurrent', async () => {
  if (currentSourceMode === 'local') {
    return localPlaybackState.current ? {
      item: localPlaybackState.current,
      is_playing: localPlaybackState.is_playing,
      progress_ms: localPlaybackState.progress_ms
    } : null;
  }

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
  if (currentSourceMode === 'local') {
    return localPlaybackState.volume;
  }

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
  if (currentSourceMode === 'local') {
    return { queue: localPlaybackState.queue };
  }

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

ipcMain.handle('playLocalTrack', async (_e, localPath) => {
  const normalizedPath = typeof localPath === 'string' ? path.normalize(localPath) : '';
  if (!normalizedPath || !win || win.isDestroyed()) {
    return false;
  }

  const activeSource = getActiveLocalAudioSource();
  if (!activeSource) {
    return false;
  }

  const library = await getLocalAudioLibrary(activeSource);
  const trackExists = library.some(track => track.localPath === normalizedPath);
  if (!trackExists) {
    return false;
  }

  win.webContents.send('playLocalTrackRequested', { localPath: normalizedPath });
  return true;
});

ipcMain.handle('forceRefresh', async () => {
  logger.log('refresh', 'forced refresh triggered');
  // Broadcast refresh signal to all windows - they'll call getCurrent
  if (win && !win.isDestroyed()) win.webContents.send('forceRefresh');
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('forceRefresh');
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('forceRefresh');
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('forceRefresh');
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('forceRefresh');
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
    clearPendingSpotifyAuth();
    
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
  clearPendingSpotifyAuth();
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
  if (localWin && !localWin.isDestroyed()) {
    logger.log('auth', 'sending loggedOut to local window');
    localWin.webContents.send('loggedOut');
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
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('themeChanged', theme);
  return theme;
});

ipcMain.handle('getTheme', async () => {
  return currentTheme;
});

ipcMain.handle('getSourceMode', async () => {
  return currentSourceMode;
});

ipcMain.handle('setSourceMode', async (_e, mode) => {
  const allowedModes = new Set(['spotify', 'local']);
  if (!allowedModes.has(mode)) {
    throw new Error(`Invalid source mode: ${mode}`);
  }

  if (mode !== 'local' && localWin && !localWin.isDestroyed()) {
    try {
      localWin.close();
    } catch (e) {}
    localWin = null;
  }

  currentSourceMode = mode;
  storage.setSourceMode(mode);

  if (win && !win.isDestroyed()) win.webContents.send('sourceModeChanged', mode);
  if (moreWin && !moreWin.isDestroyed()) moreWin.webContents.send('sourceModeChanged', mode);
  if (queueWin && !queueWin.isDestroyed()) queueWin.webContents.send('sourceModeChanged', mode);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('sourceModeChanged', mode);
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('sourceModeChanged', mode);

  return mode;
});

ipcMain.handle('getLocalAudioSources', async () => {
  return getLocalAudioSources();
});

ipcMain.handle('getLocalSourceItems', async () => {
  return getLocalSourceItems();
});

ipcMain.handle('getActiveLocalAudioSource', async () => {
  return getActiveLocalAudioSource();
});

ipcMain.handle('pickAudioFiles', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Audio Files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'] }
    ]
  });

  if (canceled || !filePaths.length) {
    return getLocalAudioSources();
  }

  const existingSources = getLocalAudioSources();
  const nextSources = setLocalAudioSources({
    files: [...existingSources.files, ...filePaths],
    folders: existingSources.folders
  });

  invalidateLocalAudioLibraryCache();
  syncActiveLocalAudioSource(nextSources);

  broadcastLocalAudioSourcesChanged(nextSources);
  return nextSources;
});

ipcMain.handle('pickAudioFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Audio Folder',
    properties: ['openDirectory']
  });

  if (canceled || !filePaths.length) {
    return getLocalAudioSources();
  }

  const existingSources = getLocalAudioSources();
  const nextSources = setLocalAudioSources({
    files: existingSources.files,
    folders: [...existingSources.folders, ...filePaths]
  });

  invalidateLocalAudioLibraryCache();
  syncActiveLocalAudioSource(nextSources);

  broadcastLocalAudioSourcesChanged(nextSources);
  return nextSources;
});

ipcMain.handle('removeLocalAudioSources', async (_e, entries = []) => {
  const existingSources = getLocalAudioSources();
  const previousActiveSource = getActiveLocalAudioSource();
  const removableEntries = Array.isArray(entries)
    ? entries.map(normalizeLocalAudioSourceEntry).filter(Boolean)
    : [];

  if (!removableEntries.length) {
    return {
      sources: existingSources,
      activeSource: getActiveLocalAudioSource()
    };
  }

  const removeKeys = new Set(removableEntries.map(entry => `${entry.type}:${entry.path}`));
  const nextSources = setLocalAudioSources({
    files: existingSources.files.filter(filePath => !removeKeys.has(`file:${filePath}`)),
    folders: existingSources.folders.filter(folderPath => !removeKeys.has(`folder:${folderPath}`))
  });

  invalidateLocalAudioLibraryCache();
  let nextActiveSource = syncActiveLocalAudioSource(nextSources);

  if (previousActiveSource && !nextActiveSource) {
    const fallbackSource = getFirstAvailableLocalAudioSource(nextSources);
    if (fallbackSource) {
      nextActiveSource = setActiveLocalAudioSource(fallbackSource);
    }
  }

  if (!sameLocalAudioSource(previousActiveSource, nextActiveSource)) {
    clearLocalPlaybackState();
    broadcastLocalActiveSourceChanged({ source: nextActiveSource, autoplay: false });
  }

  broadcastLocalAudioSourcesChanged(nextSources);
  return {
    sources: nextSources,
    activeSource: nextActiveSource
  };
});

ipcMain.handle('clearLocalAudioFiles', async () => {
  const existingSources = getLocalAudioSources();
  const previousActiveSource = getActiveLocalAudioSource();
  const nextSources = setLocalAudioSources({
    files: [],
    folders: existingSources.folders
  });

  invalidateLocalAudioLibraryCache();
  let nextActiveSource = syncActiveLocalAudioSource(nextSources);
  if (previousActiveSource && !nextActiveSource) {
    const fallbackSource = getFirstAvailableLocalAudioSource(nextSources);
    if (fallbackSource) {
      nextActiveSource = setActiveLocalAudioSource(fallbackSource);
    }
  }
  if (!sameLocalAudioSource(previousActiveSource, nextActiveSource)) {
    clearLocalPlaybackState();
    broadcastLocalActiveSourceChanged({ source: nextActiveSource, autoplay: false });
  }
  broadcastLocalAudioSourcesChanged(nextSources);
  return nextSources;
});

ipcMain.handle('clearLocalAudioFolders', async () => {
  const existingSources = getLocalAudioSources();
  const previousActiveSource = getActiveLocalAudioSource();
  const nextSources = setLocalAudioSources({
    files: existingSources.files,
    folders: []
  });

  invalidateLocalAudioLibraryCache();
  let nextActiveSource = syncActiveLocalAudioSource(nextSources);
  if (previousActiveSource && !nextActiveSource) {
    const fallbackSource = getFirstAvailableLocalAudioSource(nextSources);
    if (fallbackSource) {
      nextActiveSource = setActiveLocalAudioSource(fallbackSource);
    }
  }
  if (!sameLocalAudioSource(previousActiveSource, nextActiveSource)) {
    clearLocalPlaybackState();
    broadcastLocalActiveSourceChanged({ source: nextActiveSource, autoplay: false });
  }
  broadcastLocalAudioSourcesChanged(nextSources);
  return nextSources;
});

ipcMain.handle('clearLocalAudioSources', async () => {
  const nextSources = setLocalAudioSources({ files: [], folders: [] });

  invalidateLocalAudioLibraryCache();
  syncActiveLocalAudioSource(nextSources);
  clearLocalPlaybackState();
  broadcastLocalActiveSourceChanged({ source: null, autoplay: false });
  broadcastLocalAudioSourcesChanged(nextSources);
  return nextSources;
});

ipcMain.handle('setActiveLocalAudioSource', async (_e, source, options = {}) => {
  const nextSource = setActiveLocalAudioSource(source);

  invalidateLocalAudioLibraryCache();
  clearLocalPlaybackState();

  const payload = {
    source: nextSource,
    autoplay: !!options?.autoplay
  };

  broadcastLocalActiveSourceChanged(payload);
  return payload;
});

ipcMain.handle('getLocalAudioLibrary', async (_e, source) => {
  return getLocalAudioLibrary(source);
});

ipcMain.handle('updateLocalPlaybackState', async (_e, state) => {
  localPlaybackState = normalizeLocalPlaybackState(state);
  broadcastLocalPlaybackStateChanged(localPlaybackState);
  return true;
});

ipcMain.handle('getLocalPlaybackState', async () => {
  return localPlaybackState;
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
  if (localWin && !localWin.isDestroyed()) localWin.webContents.send('updateStatusChanged', { status: updateStatus, info: updateInfo });
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
    if (isInvalidGrantAuthError(e)) {
      refreshToken = null;
      await clearRefreshToken();
    }
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
    icon: path.join(__dirname, '../assets/MiniBoxIcon2.png'),
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

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => win.show());
  // win.webContents.openDevTools({ mode: 'detach' }); //optional
}

const { createQueueWindow, closeQueueWindow } = registerQueueWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir: __dirname,
  getMainWindow: () => win,
  getQueueWindow: () => queueWin,
  setQueueWindow: (nextWindow) => { queueWin = nextWindow; },
  closeMoreWindow: () => {
    if (moreWin && !moreWin.isDestroyed()) {
      try {
        moreWin.close();
      } catch (e) {}
      moreWin = null;
    }
  },
  closeSettingsWindow: () => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      try {
        settingsWin.close();
      } catch (e) {}
      settingsWin = null;
    }
  },
  closeLocalWindow: () => {
    if (localWin && !localWin.isDestroyed()) {
      try {
        localWin.close();
      } catch (e) {}
      localWin = null;
    }
  }
});

const { createMoreWindow, closeMoreWindow } = registerMoreWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir: __dirname,
  getMainWindow: () => win,
  getMoreWindow: () => moreWin,
  setMoreWindow: (nextWindow) => { moreWin = nextWindow; },
  shouldStartCompact: () => currentSourceMode === 'local' || !accessToken,
  closeQueueWindow,
  closeSettingsWindow: () => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      try {
        settingsWin.close();
      } catch (e) {}
      settingsWin = null;
    }
  },
  closeLocalWindow: () => {
    if (localWin && !localWin.isDestroyed()) {
      try {
        localWin.close();
      } catch (e) {}
      localWin = null;
    }
  }
});

const { createSettingsWindow, closeSettingsWindow } = registerSettingsWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir: __dirname,
  getMainWindow: () => win,
  getSettingsWindow: () => settingsWin,
  setSettingsWindow: (nextWindow) => { settingsWin = nextWindow; },
  closeQueueWindow,
  closeMoreWindow,
  closeLocalWindow: () => {
    if (localWin && !localWin.isDestroyed()) {
      try {
        localWin.close();
      } catch (e) {}
      localWin = null;
    }
  }
});

const { createLocalWindow, closeLocalWindow, applyLocalWindowLayout } = registerLocalWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir: __dirname,
  getMainWindow: () => win,
  getLocalWindow: () => localWin,
  setLocalWindow: (nextWindow) => { localWin = nextWindow; },
  getLocalImportCount: () => getLocalImportCount(),
  closeQueueWindow,
  closeMoreWindow,
  closeSettingsWindow
});

const { createPatchWindow } = registerPatchWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir: __dirname,
  getMainWindow: () => win,
  getPatchWindow: () => patchWin,
  setPatchWindow: (nextWindow) => { patchWin = nextWindow; }
});

app.whenReady().then(async () => {
  logger.log('startup', '========== MiniBox App Started ==========');
  logger.log('startup', `Version: ${app.getVersion()}`);
  
  // Start auth server for Spotify OAuth redirects
  try {
    await startAuthServer();
  } catch (err) {
    logger.log('error', `Failed to start auth server on ${getAuthServerBaseUrl()}: ${err.message}`);
  }
  
  // Set app icon for taskbar and system
  const iconPath = path.join(__dirname, '../assets/MiniBoxIcon2.ico');
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

  // Check if app was updated and show patch notes
  const currentVersion = app.getVersion();
  const lastSeenVersion = storage.getLastSeenVersion();
  
  if (lastSeenVersion && lastSeenVersion !== currentVersion) {
    logger.log('startup', `App updated from ${lastSeenVersion} to ${currentVersion}`);
    // Delay showing patch window to ensure main window is ready
    setTimeout(() => {
      createPatchWindow();
    }, 1000);
  }
  
  // Always update the last seen version
  storage.setLastSeenVersion(currentVersion);

  // if we were already authed by restore, tell the renderer once it loads
  if (restored || accessToken) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('authed');
    });
  }

  app.on('before-quit', () => {
    // Save accumulated runtime before closing
    storage.saveTotalRuntime(appStartTime);
    
    // Close auth server
    if (authServer) {
      authServer.close();
      authServer = null;
      authServerReady = false;
      logger.log('shutdown', 'Auth server closed');
    }
    
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