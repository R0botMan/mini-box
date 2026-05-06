module.exports = function registerLocalWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getLocalWindow,
  setLocalWindow,
  getLocalImportCount,
  closeQueueWindow,
  closeMoreWindow,
  closeSettingsWindow
}) {
  let currentLayoutState = {
    view: 'browser',
    visibleCount: Math.max(0, Number(getLocalImportCount?.() || 0))
  };

  function normalizeLayoutState(layoutState) {
    if (typeof layoutState === 'number') {
      return {
        view: currentLayoutState.view,
        visibleCount: Math.max(0, Number(layoutState) || 0)
      };
    }

    return {
      view: layoutState?.view === 'queue' ? 'queue' : 'browser',
      visibleCount: Math.max(0, Number(layoutState?.visibleCount) || 0)
    };
  }

  // These pretty much define the size of the local window based on how many items are visible in the queue 
  function getQueueWindowLayout(visibleCount) {
    if (visibleCount === 1) {
      return {
        width: 270,
        height: 130,
        localWidth: 180,
        localHeight: 90
      };
    }

    if (visibleCount === 2) {
      return {
        width: 270,
        height: 180,
        localWidth: 180,
        localHeight: 140
      };
    }

    if (visibleCount >= 3) {
      return {
        width: 270,
        height: 240,
        localWidth: 180,
        localHeight: 190
      };
    }

    return {
      width: 370,
      height: 310,
      localWidth: 390,
      localHeight: 270
    };
  }

  // The local window with a max of 3 items visible
  function getBrowserWindowLayout(visibleCount) {
    if (visibleCount === 0) {
      return {
        width: 270,
        height: 210,
        localWidth: 180,
        localHeight: 170
      };
    }
    if (visibleCount === 1) {
      return {
        width: 270,
        height: 190,
        localWidth: 180,
        localHeight: 130
      };
    }

    if (visibleCount === 2) {
      return {
        width: 270,
        height: 250,
        localWidth: 180,
        localHeight: 200
      };
    }

    return {
      width: 270,
      height: 300,
      localWidth: 180,
      localHeight: 240
    };
  }

  function getLocalWindowLayout(layoutState = currentLayoutState) {
    const normalizedLayoutState = normalizeLayoutState(layoutState);
    const safeVisibleCount = normalizedLayoutState.visibleCount;

    return normalizedLayoutState.view === 'queue'
      ? getQueueWindowLayout(safeVisibleCount)
      : getBrowserWindowLayout(safeVisibleCount);
  }

  function applyLocalWindowLayout(layoutState = currentLayoutState) {
    const localWin = getLocalWindow();
    const win = getMainWindow();
    if (!localWin || localWin.isDestroyed() || !win || win.isDestroyed()) {
      return;
    }

    currentLayoutState = normalizeLayoutState(layoutState);
    const { width, height, localWidth, localHeight } = getLocalWindowLayout(currentLayoutState);

    const [x, y] = win.getPosition();
    const [winWidth] = win.getSize();
    const nextX = Math.round(x + (winWidth - localWidth) / 2);
    const nextY = Math.round(y - localHeight - 12);

    localWin.setContentSize(width, height);
    localWin.setBounds({ x: nextX, y: nextY, width, height });
  }

  function closeLocalWindow() {
    const localWin = getLocalWindow();
    if (localWin && !localWin.isDestroyed()) {
      try {
        localWin.close();
      } catch (e) {}
      setLocalWindow(null);
    }
  }

  function createLocalWindow() {
    if (getLocalWindow()) {
      getLocalWindow().focus();
      return;
    }

    const win = getMainWindow();
    const localWin = new BrowserWindow({
      width: 370,
      height: 300,
      useContentSize: true,
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
    localWin.setAlwaysOnTop(true, 'floating');

    setLocalWindow(localWin);
    localWin.loadFile(path.join(baseDir, '../renderer/local.html'));

    currentLayoutState = normalizeLayoutState({
      view: 'browser',
      visibleCount: getLocalImportCount?.() || 0
    });
    applyLocalWindowLayout(currentLayoutState);

    const moveHandler = () => {
      try {
        const currentLocalWin = getLocalWindow();
        if (currentLocalWin && !currentLocalWin.isDestroyed()) {
          applyLocalWindowLayout();
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    localWin.once('ready-to-show', () => {
      applyLocalWindowLayout(currentLayoutState);
      localWin.show();
      try {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localOpened');
        }
      } catch (e) {}
    });

    localWin.on('closed', () => {
      setLocalWindow(null);
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
          win.webContents.send('localClosed');
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('toggleLocal', () => {
    closeQueueWindow();
    closeMoreWindow();
    closeSettingsWindow();

    if (getLocalWindow() && !getLocalWindow().isDestroyed()) {
      closeLocalWindow();
    } else {
      createLocalWindow();
    }
    return !getLocalWindow();
  });

  ipcMain.handle('refreshLocalWindowLayout', () => {
    applyLocalWindowLayout({
      view: 'browser',
      visibleCount: getLocalImportCount?.() || currentLayoutState.visibleCount
    });
    return true;
  });

  ipcMain.handle('setLocalWindowImportCount', (_event, layoutState) => {
    applyLocalWindowLayout(layoutState);
    return true;
  });

  return {
    applyLocalWindowLayout,
    createLocalWindow,
    closeLocalWindow
  };
};
