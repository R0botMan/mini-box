module.exports = function registerMoreWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getMoreWindow,
  setMoreWindow,
  shouldStartCompact,
  closeQueueWindow,
  closeSettingsWindow,
  closeLocalWindow
}) {
  let isCompactMore = false;

  function applyMoreWindowLayout(compact = false) {
    const moreWin = getMoreWindow();
    const win = getMainWindow();
    if (!moreWin || moreWin.isDestroyed() || !win || win.isDestroyed()) {
      return;
    }

    isCompactMore = compact;
    const width = 304;
    const height = compact ? 90 : 140;
    const moreWidth = 230;
    const moreHeight = compact ? 50 : 80;

    moreWin.setSize(width, height);

    const [x, y] = win.getPosition();
    moreWin.setPosition(x + moreWidth, y - moreHeight - 10);
  }

  function closeMoreWindow() {
    const moreWin = getMoreWindow();
    if (moreWin && !moreWin.isDestroyed()) {
      try {
        moreWin.close();
      } catch (e) {}
      setMoreWindow(null);
    }
  }

  function createMoreWindow() {
    if (getMoreWindow()) {
      getMoreWindow().focus();
      return;
    }

    const win = getMainWindow();
    const moreWin = new BrowserWindow({
      width: 304,
      height: 90,
      frame: false,
      transparent: true,
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
    moreWin.setAlwaysOnTop(true, 'floating');

    setMoreWindow(moreWin);
    moreWin.loadFile(path.join(baseDir, '../renderer/more.html'));

    applyMoreWindowLayout(!!shouldStartCompact?.());

    const moveHandler = () => {
      try {
        const currentMoreWin = getMoreWindow();
        if (currentMoreWin && !currentMoreWin.isDestroyed()) {
          applyMoreWindowLayout(isCompactMore);
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    moreWin.once('ready-to-show', () => {
      applyMoreWindowLayout(!!shouldStartCompact?.() || isCompactMore);
      moreWin.show();
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('moreOpened');
        }
      } catch (e) {}
    });

    moreWin.on('closed', () => {
      setMoreWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('moreClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleMore', () => {
    closeQueueWindow();
    closeSettingsWindow();
    closeLocalWindow();

    if (getMoreWindow() && !getMoreWindow().isDestroyed()) {
      closeMoreWindow();
    } else {
      createMoreWindow();
    }
    return !getMoreWindow();
  });

  ipcMain.handle('setMoreWindowCompact', (_event, compact) => {
    applyMoreWindowLayout(!!compact);
    return true;
  });

  return {
    createMoreWindow,
    closeMoreWindow
  };
};
