module.exports = function registerPatchWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getPatchWindow,
  setPatchWindow
}) {
  let patchLayout = {
    width: 480,
    height: 600,
    patchWidth: 1280,
    patchHeight: 1080,
  };

  function applyPatchWindowLayout(nextLayout = {}) {
    const patchWin = getPatchWindow();
    const win = getMainWindow();
    if (!patchWin || patchWin.isDestroyed() || !win || win.isDestroyed()) {
      return;
    }

    patchLayout = {
      ...patchLayout,
      ...nextLayout,
    };

    patchWin.setSize(patchLayout.width, patchLayout.height);

    const [x, y] = win.getPosition();
    const [winWidth, winHeight] = win.getSize();
    const centeredX = x + (winWidth - patchLayout.patchWidth) / 2;
    const centeredY = y + (winHeight - patchLayout.patchHeight) / 2;
    patchWin.setPosition(Math.round(centeredX), Math.round(centeredY));
  }

  function closePatchWindow() {
    const patchWin = getPatchWindow();
    if (patchWin && !patchWin.isDestroyed()) {
      try {
        patchWin.close();
      } catch (e) {}
      setPatchWindow(null);
    }
  }

  function createPatchWindow() {
    if (getPatchWindow()) {
      getPatchWindow().focus();
      return;
    }

    const win = getMainWindow();
    const patchWin = new BrowserWindow({
      width: 480,
      height: 400,
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

    setPatchWindow(patchWin);
    patchWin.loadFile(path.join(baseDir, '../renderer/patch.html'));

    applyPatchWindowLayout();

    const moveHandler = () => {
      try {
        const currentPatchWin = getPatchWindow();
        if (currentPatchWin && !currentPatchWin.isDestroyed()) {
          applyPatchWindowLayout();
        }
      } catch (e) {}
    };
    win.on('move', moveHandler);

    patchWin.once('ready-to-show', () => {
      patchWin.show();
    });

    patchWin.on('closed', () => {
      try {
        if (win && !win.isDestroyed()) {
          win.removeListener('move', moveHandler);
        }
      } catch (e) {}
      setPatchWindow(null);
    });
  }

  ipcMain.handle('closePatch', () => {
    closePatchWindow();
    return true;
  });

  ipcMain.handle('openPatchWindow', () => {
    createPatchWindow();
    return true;
  });

  ipcMain.handle('setPatchWindowLayout', (_event, layout) => {
    applyPatchWindowLayout(layout);
    return true;
  });

  return {
    createPatchWindow,
    closePatchWindow
  };
};
