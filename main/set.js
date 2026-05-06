module.exports = function registerSetupWindow({ BrowserWindow, ipcMain, path, baseDir, getMainWindow, getSetupWindow, setSetupWindow, 
    closeQueueWindow, closeMoreWindow, closeLocalWindow, closeSettingsWindow, closeOnboardingWindow = () => {} }) {
  const WINDOW_WIDTH = 280;
  const WINDOW_HEIGHT = 290;
  const LAYOUT_WIDTH = 360;
  const LAYOUT_HEIGHT = 660;

  function closeSetupWindow() {
    const setupWin = getSetupWindow();
    if (setupWin && !setupWin.isDestroyed()) {
      try {
        setupWin.close();
      } catch (e) {}
      setSetupWindow(null);
    }
  }

  function createSetupWindow() {
    if (getSetupWindow() && !getSetupWindow().isDestroyed()) {
      getSetupWindow().focus();
      return;
    }

    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }

    const setupWin = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
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
    setupWin.setAlwaysOnTop(true, 'floating');

    setSetupWindow(setupWin);
    setupWin.loadFile(path.join(baseDir, '../renderer/setup.html'));

    const [x, y] = win.getPosition();
    const [winWidth, winHeight] = win.getSize();
    const centeredX = x + (winWidth - LAYOUT_WIDTH) / 2;
    const centeredY = y + (winHeight - LAYOUT_HEIGHT) / 2;
    setupWin.setPosition(Math.round(centeredX), Math.round(centeredY));

    const moveHandler = () => {
      try {
        const currentSetupWin = getSetupWindow();
        if (currentSetupWin && !currentSetupWin.isDestroyed()) {
          const [newX, newY] = win.getPosition();
          const nextX = newX + (winWidth - LAYOUT_WIDTH) / 2;
          const nextY = newY + (winHeight - LAYOUT_HEIGHT) / 2;
          currentSetupWin.setPosition(Math.round(nextX), Math.round(nextY));
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    setupWin.once('ready-to-show', () => {
      setupWin.show();
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('setupOpened');
        }
      } catch (e) {}
    });

    setupWin.on('closed', () => {
      setSetupWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('setupClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleSetup', () => {
    closeQueueWindow();
    closeMoreWindow();
    closeLocalWindow();
    closeSettingsWindow();
    closeOnboardingWindow();

    if (getSetupWindow() && !getSetupWindow().isDestroyed()) {
      closeSetupWindow();
    } else {
      createSetupWindow();
    }

    return !getSetupWindow();
  });

  return {
    createSetupWindow,
    closeSetupWindow
  };
};
