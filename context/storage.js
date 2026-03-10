const Store = require('electron-store').default;

// Create store with default values
const store = new Store({
  defaults: {
    theme: 'dark',
    appStartTime: Date.now(), // timestamp of app first run
    totalRuntime: 0, // accumulated runtime in ms
  }
});

module.exports = {
  // Theme management
  getTheme: () => store.get('theme'),
  setTheme: (theme) => store.set('theme', theme),

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

  // Get all stored data
  getAll: () => store.store,

  // Clear all data (useful for debugging)
  clear: () => {
    store.clear();
  }
};
