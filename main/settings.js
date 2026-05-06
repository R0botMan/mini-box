module.exports = function registerSettingsWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getSettingsWindow,
  setSettingsWindow,
  closeQueueWindow,
  closeMoreWindow,
  closeLocalWindow
}) {
  function closeSettingsWindow() {
    const settingsWin = getSettingsWindow();
    if (settingsWin && !settingsWin.isDestroyed()) {
      try {
        settingsWin.close();
      } catch (e) {}
      setSettingsWindow(null);
    }
  }

  function createSettingsWindow() {
    if (getSettingsWindow()) {
      getSettingsWindow().focus();
      return;
    }

    const win = getMainWindow();
    const settingsWin = new BrowserWindow({
      width: 320,
      height: 220,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(baseDir, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: true,
      }
    });
    settingsWin.setAlwaysOnTop(true, 'floating');

    setSettingsWindow(settingsWin);
    settingsWin.loadFile(path.join(baseDir, '../renderer/settings.html'));

    const [x, y] = win.getPosition();
    const [winWidth, winHeight] = win.getSize();
    const settingsWidth = 360;
    const settingsHeight = 560;
    const centeredX = x + (winWidth - settingsWidth) / 2;
    const centeredY = y + (winHeight - settingsHeight) / 2;
    settingsWin.setPosition(Math.round(centeredX), Math.round(centeredY));

    const moveHandler = () => {
      try {
        const currentSettingsWin = getSettingsWindow();
        if (currentSettingsWin && !currentSettingsWin.isDestroyed()) {
          const [newX, newY] = win.getPosition();
          const nextX = newX + (winWidth - settingsWidth) / 2;
          const nextY = newY + (winHeight - settingsHeight) / 2;
          currentSettingsWin.setPosition(Math.round(nextX), Math.round(nextY));
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
      setSettingsWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('settingsClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleSettings', () => {
    closeQueueWindow();
    closeMoreWindow();
    closeLocalWindow();

    if (getSettingsWindow() && !getSettingsWindow().isDestroyed()) {
      closeSettingsWindow();
    } else {
      createSettingsWindow();
    }
    return !getSettingsWindow();
  });

  return {
    createSettingsWindow,
    closeSettingsWindow
  };
};
