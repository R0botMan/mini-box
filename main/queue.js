module.exports = function registerQueueWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getQueueWindow,
  setQueueWindow,
  closeMoreWindow,
  closeSettingsWindow,
  closeLocalWindow
}) {
  let currentQueueSongCount = 0;

  function normalizeQueueSongCount(songCount) {
    return Math.max(0, Number(songCount) || 0);
  }

  function getQueueWindowLayout(songCount = currentQueueSongCount) {
    const safeSongCount = normalizeQueueSongCount(songCount);

    if (safeSongCount === 0) {
      return {
        width: 254,
        height: 85,
        queueWidth: 115,
        queueHeight: 40
      };
    }

    if (safeSongCount === 1) {
      return {
        width: 254,
        height: 85,
        queueWidth: 115,
        queueHeight: 70
      };
    }

    if (safeSongCount === 2) {
      return {
        width: 254,
        height: 96,
        queueWidth: 115,
        queueHeight: 70
      };
    }

    return {
      width: 254,
      height: 122,
      queueWidth: 115,
      queueHeight: 70
    };
  }

  function applyQueueWindowLayout(songCount = currentQueueSongCount) {
    const queueWin = getQueueWindow();
    const win = getMainWindow();
    if (!queueWin || queueWin.isDestroyed() || !win || win.isDestroyed()) {
      return;
    }

    currentQueueSongCount = normalizeQueueSongCount(songCount);
    const { width, height, queueWidth, queueHeight } = getQueueWindowLayout(currentQueueSongCount);

    queueWin.setSize(width, height);

    const [x, y] = win.getPosition();
    queueWin.setPosition(x + queueWidth, y - queueHeight - 10);
  }

  function closeQueueWindow() {
    const queueWin = getQueueWindow();
    if (queueWin && !queueWin.isDestroyed()) {
      try {
        queueWin.close();
      } catch (e) {}
      setQueueWindow(null);
    }
  }

  function createQueueWindow() {
    if (getQueueWindow()) {
      getQueueWindow().focus();
      return;
    }

    const win = getMainWindow();
    const queueWin = new BrowserWindow({
      width: 254,
      height: 122,
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
    queueWin.setAlwaysOnTop(true, 'floating');

    setQueueWindow(queueWin);
    queueWin.loadFile(path.join(baseDir, '../renderer/queue.html'));

    applyQueueWindowLayout(currentQueueSongCount);
    let didShowQueueWindow = false;
    let showFallbackTimeout = null;

    const showQueueWindow = () => {
      if (didShowQueueWindow || queueWin.isDestroyed()) {
        return;
      }

      didShowQueueWindow = true;
      applyQueueWindowLayout(currentQueueSongCount);
      queueWin.show();
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('queueOpened');
        }
      } catch (e) {}
    };

    const moveHandler = () => {
      try {
        const currentQueueWin = getQueueWindow();
        if (currentQueueWin && !currentQueueWin.isDestroyed()) {
          applyQueueWindowLayout(currentQueueSongCount);
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    queueWin.once('ready-to-show', showQueueWindow);
    queueWin.webContents.once('did-finish-load', showQueueWindow);
    showFallbackTimeout = setTimeout(showQueueWindow, 500);

    queueWin.on('closed', () => {
      if (showFallbackTimeout) {
        clearTimeout(showFallbackTimeout);
        showFallbackTimeout = null;
      }
      setQueueWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('queueClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleQueue', () => {
    closeMoreWindow();
    closeSettingsWindow();
    closeLocalWindow();

    if (getQueueWindow() && !getQueueWindow().isDestroyed()) {
      closeQueueWindow();
    } else {
      createQueueWindow();
    }
    return !getQueueWindow();
  });

  ipcMain.handle('setQueueWindowCompact', (_event, compact) => {
    applyQueueWindowLayout(compact ? 1 : 3);
    return true;
  });

  ipcMain.handle('setQueueWindowSongCount', (_event, songCount) => {
    applyQueueWindowLayout(songCount);
    return true;
  });

  return {
    createQueueWindow,
    closeQueueWindow
  };
};
