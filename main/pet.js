module.exports = function registerPetWindow({
  BrowserWindow,
  ipcMain,
  path,
  baseDir,
  getMainWindow,
  getPetWindow,
  setPetWindow,
  getPetSelection
}) {
  const PET_WIDTH = 122;
  const PET_HEIGHT = 96;
  const PET_OFFSET_X = 6;
  const PET_OFFSET_Y = 27;

  function positionPetWindow() {
    const petWin = getPetWindow();
    const mainWin = getMainWindow();
    if (!petWin || petWin.isDestroyed() || !mainWin || mainWin.isDestroyed()) {
      return;
    }

    const [x, y] = mainWin.getPosition();
    petWin.setPosition(Math.round(x + PET_OFFSET_X), Math.round(y - PET_OFFSET_Y));
  }

  function closePetWindow() {
    const petWin = getPetWindow();
    if (petWin && !petWin.isDestroyed()) {
      try {
        petWin.close();
      } catch (e) {}
      setPetWindow(null);
    }
  }

  function createPetWindow() {
    const selectedPet = String(getPetSelection?.() || 'none');
    if (selectedPet === 'none') {
      closePetWindow();
      return;
    }

    const existing = getPetWindow();
    if (existing && !existing.isDestroyed()) {
      existing.webContents.send('petSelectionChanged', selectedPet);
      positionPetWindow();
      existing.show();
      return;
    }

    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) {
      return;
    }

    const petWin = new BrowserWindow({
      width: PET_WIDTH,
      height: PET_HEIGHT,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: true,
      alwaysOnTop: true,
      parent: mainWin,
      show: false,
      webPreferences: {
        preload: path.join(baseDir, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: true,
      }
    });

    petWin.setAlwaysOnTop(true, 'normal');
    setPetWindow(petWin);
    petWin.loadFile(path.join(baseDir, '../renderer/pet.html'), {
      query: { pet: selectedPet }
    });

    const moveHandler = () => {
      try {
        positionPetWindow();
      } catch (e) {}
    };
    mainWin.on('move', moveHandler);

    petWin.once('ready-to-show', () => {
      positionPetWindow();
      petWin.showInactive();
    });

    petWin.on('closed', () => {
      setPetWindow(null);
      try {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.removeListener('move', moveHandler);
        }
      } catch (e) {}
    });
  }

  ipcMain.handle('togglePet', () => {
    const selectedPet = String(getPetSelection?.() || 'none');
    if (selectedPet === 'none') {
      closePetWindow();
      return false;
    }

    const petWin = getPetWindow();
    if (petWin && !petWin.isDestroyed() && petWin.isVisible()) {
      petWin.hide();
      return false;
    }

    createPetWindow();
    return true;
  });

  return {
    createPetWindow,
    closePetWindow,
    positionPetWindow
  };
};
