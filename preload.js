const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login:      () => ipcRenderer.invoke('login'),
  isAuthed:   () => ipcRenderer.invoke('isAuthed'),
  getCurrent: () => ipcRenderer.invoke('getCurrent'),
  playPause:  () => ipcRenderer.invoke('playPause'),
  next:       () => ipcRenderer.invoke('next'),
  prev:       () => ipcRenderer.invoke('prev'),
  logout:     () => ipcRenderer.invoke('logout'),
  onAuthed:   (cb) => ipcRenderer.on('authed', cb),
  onLoggedOut:(cb) => ipcRenderer.on('loggedOut', cb),
  seek: (ms) => ipcRenderer.invoke('seek', ms),
  getVolume: () => ipcRenderer.invoke('getVolume'),
  setVolume: (pct) => ipcRenderer.invoke('setVolume', pct),
  getAccessToken: () => ipcRenderer.invoke('getAccessToken'),
  transferPlayback: (deviceId, play = true) => ipcRenderer.invoke('transferPlayback', deviceId, play),
  getDevices: () => ipcRenderer.invoke('getDevices'),
  growForOptions:  (px) => ipcRenderer.invoke('growForOptions', px),
  shrinkForOptions:(px) => ipcRenderer.invoke('shrinkAfterOptions', px),
  openSpotifyAccount: () => ipcRenderer.invoke('openSpotifyAccount'),
  closeApp: () => ipcRenderer.invoke('closeApp'),
});
