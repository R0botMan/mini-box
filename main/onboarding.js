module.exports = function registerOnboardingWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getOnboardingWindow,
  setOnboardingWindow,
  closeQueueWindow,
  closeMoreWindow,
  closeLocalWindow,
  closeSettingsWindow,
  closeSetupWindow
}) {
  const WINDOW_WIDTH = 320;
  const WINDOW_HEIGHT = 240;
  const LAYOUT_WIDTH = 360;
  const LAYOUT_HEIGHT = 600;

  function closeOnboardingWindow() {
    const onboardingWin = getOnboardingWindow();
    if (onboardingWin && !onboardingWin.isDestroyed()) {
      try {
        onboardingWin.close();
      } catch (e) {}
      setOnboardingWindow(null);
    }
  }

  function createOnboardingWindow() {
    if (getOnboardingWindow() && !getOnboardingWindow().isDestroyed()) {
      getOnboardingWindow().focus();
      return;
    }

    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }

    const onboardingWin = new BrowserWindow({
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
    onboardingWin.setAlwaysOnTop(true, 'floating');

    setOnboardingWindow(onboardingWin);
    onboardingWin.loadFile(path.join(baseDir, '../renderer/onboarding.html'));

    const [x, y] = win.getPosition();
    const [winWidth, winHeight] = win.getSize();
    const centeredX = x + (winWidth - LAYOUT_WIDTH) / 2;
    const centeredY = y + (winHeight - LAYOUT_HEIGHT) / 2;
    onboardingWin.setPosition(Math.round(centeredX), Math.round(centeredY));

    const moveHandler = () => {
      try {
        const currentOnboardingWin = getOnboardingWindow();
        if (currentOnboardingWin && !currentOnboardingWin.isDestroyed()) {
          const [newX, newY] = win.getPosition();
          const nextX = newX + (winWidth - LAYOUT_WIDTH) / 2;
          const nextY = newY + (winHeight - LAYOUT_HEIGHT) / 2;
          currentOnboardingWin.setPosition(Math.round(nextX), Math.round(nextY));
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    onboardingWin.once('ready-to-show', () => {
      onboardingWin.show();
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('onboardingOpened');
        }
      } catch (e) {}
    });

    onboardingWin.on('closed', () => {
      setOnboardingWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('onboardingClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleOnboarding', () => {
    closeQueueWindow();
    closeMoreWindow();
    closeLocalWindow();
    closeSettingsWindow();
    closeSetupWindow();

    if (getOnboardingWindow() && !getOnboardingWindow().isDestroyed()) {
      closeOnboardingWindow();
    } else {
      createOnboardingWindow();
    }

    return !getOnboardingWindow();
  });

  return {
    createOnboardingWindow,
    closeOnboardingWindow
  };
};
