const Store = require('electron-store').default;

function normalizeLocalAudioSources(sources = {}) {
  return {
    files: Array.isArray(sources.files) ? sources.files : [],
    folders: Array.isArray(sources.folders) ? sources.folders : []
  };
}

function normalizeActiveLocalAudioSource(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const type = source.type === 'file' || source.type === 'folder' ? source.type : null;
  const sourcePath = typeof source.path === 'string' ? source.path : '';

  if (!type || !sourcePath) {
    return null;
  }

  return {
    type,
    path: sourcePath
  };
}

function normalizePendingSpotifyAuth(auth) {
  if (!auth || typeof auth !== 'object') {
    return null;
  }

  const clientId = typeof auth.clientId === 'string' ? auth.clientId.trim() : '';
  const verifier = typeof auth.verifier === 'string' ? auth.verifier : '';
  const challenge = typeof auth.challenge === 'string' ? auth.challenge : '';
  const state = typeof auth.state === 'string' ? auth.state : '';
  const createdAt = Number.isFinite(auth.createdAt) ? auth.createdAt : Date.now();

  if (!clientId || !verifier || !challenge || !state) {
    return null;
  }

  return {
    clientId,
    verifier,
    challenge,
    state,
    createdAt
  };
}

function normalizeSpotifyClientId(clientId) {
  return typeof clientId === 'string' ? clientId.trim() : '';
}

// Create store with default values
const store = new Store({
  defaults: {
    theme: 'dark',
    sourceMode: 'spotify',
    petSelection: 'sleepycat',
    localAudioSources: {
      files: [],
      folders: []
    },
    activeLocalAudioSource: null,
    spotifyClientId: '',
    pendingSpotifyAuth: null,
    onboardingCompleted: false,
    updateReminderAt: 0,
    dismissedUpdateVersion: '',
    appStartTime: Date.now(), // timestamp of app first run
    totalRuntime: 0, // accumulated runtime in ms
  }
});

module.exports = {
  // Theme management
  getTheme: () => store.get('theme'),
  setTheme: (theme) => store.set('theme', theme),

  // Source mode management
  getSourceMode: () => store.get('sourceMode'),
  setSourceMode: (mode) => store.set('sourceMode', mode),

  // Pet management
  getPetSelection: () => String(store.get('petSelection') || 'none'),
  setPetSelection: (pet) => store.set('petSelection', String(pet || 'none')),

  // Local audio import management
  getLocalAudioSources: () => normalizeLocalAudioSources(store.get('localAudioSources')),
  setLocalAudioSources: (sources) => store.set('localAudioSources', normalizeLocalAudioSources(sources)),
  getActiveLocalAudioSource: () => normalizeActiveLocalAudioSource(store.get('activeLocalAudioSource')),
  setActiveLocalAudioSource: (source) => store.set('activeLocalAudioSource', normalizeActiveLocalAudioSource(source)),
  getSpotifyClientId: () => normalizeSpotifyClientId(store.get('spotifyClientId')),
  setSpotifyClientId: (clientId) => store.set('spotifyClientId', normalizeSpotifyClientId(clientId)),
  getPendingSpotifyAuth: () => normalizePendingSpotifyAuth(store.get('pendingSpotifyAuth')),
  setPendingSpotifyAuth: (auth) => store.set('pendingSpotifyAuth', normalizePendingSpotifyAuth(auth)),
  getOnboardingCompleted: () => !!store.get('onboardingCompleted'),
  setOnboardingCompleted: (completed) => store.set('onboardingCompleted', !!completed),
  getUpdateReminderAt: () => Number(store.get('updateReminderAt') || 0),
  setUpdateReminderAt: (timestamp) => store.set('updateReminderAt', Number(timestamp) || 0),
  getDismissedUpdateVersion: () => String(store.get('dismissedUpdateVersion') || ''),
  setDismissedUpdateVersion: (version) => store.set('dismissedUpdateVersion', String(version || '')),

  // Version management (for patch notes)
  getLastSeenVersion: () => store.get('lastSeenVersion'),
  setLastSeenVersion: (version) => store.set('lastSeenVersion', version),

  // Runtime management
  getAppStartTime: () => store.get('appStartTime'),
  getTotalRuntime: () => store.get('totalRuntime'),
  
  // Calculate current session runtime (ms since app started)
  getCurrentSessionRuntime: (appStartTimeMS) => {
    return Date.now() - appStartTimeMS;
  },

  // Get total runtime (accumulated + current session)
  getTotalRuntimeWithCurrentSession: (appStartTimeMS) => {
    const totalRuntime = store.get('totalRuntime');
    const currentSession = Date.now() - appStartTimeMS;
    return totalRuntime + currentSession;
  },

  // Save accumulated runtime when app closes
  saveTotalRuntime: (appStartTimeMS) => {
    const currentSession = Date.now() - appStartTimeMS;
    const totalRuntime = store.get('totalRuntime');
    store.set('totalRuntime', totalRuntime + currentSession);
  },

  // Reset app start time for new session
  resetAppStartTime: () => {
    store.set('appStartTime', Date.now());
  },

  // Reset accumulated runtime without changing other settings
  resetTotalRuntime: () => {
    store.set('totalRuntime', 0);
  },

  // Get all stored data
  getAll: () => store.store,

  // Clear all data (useful for debugging)
  clear: () => {
    store.clear();
  }
};
