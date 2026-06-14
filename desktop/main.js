'use strict';

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const trial = require('./trial');
const license = require('./license');
const updateCheck = require('./update-check');

const APP_TITLE = 'Xeomsc-Laser';
const WEBSITE_URL = 'https://xeomsc-laser.pl';
const DOWNLOADS_URL = 'https://xeomsc-laser.pl/downloads.html';
const EDITOR_FILE = path.join(__dirname, 'app', 'edytor.html');
const LICENSE_FILE = path.join(__dirname, 'app', 'license.html');
const EXPIRED_FILE = path.join(__dirname, 'trial-expired.html');
const ACTIVATE_FILE = path.join(__dirname, 'activate.html');

// Konfiguracja wersji próbnej — generowana przy buildzie przez set-trial.js.
// { trial:true, days:7 } = okres próbny; { requireActivation:true } = po jego
// zakończeniu program wymaga kodu aktywacyjnego (ekran activate.html); w
// przeciwnym razie pokazuje ekran trial-expired.html (wersja demo).
const TRIAL = trial.loadConfig(__dirname);
let TRIAL_STATUS = { expired: false, daysLeft: null };
let ACTIVATION = { activated: false, code: null };

let mainWindow = null;
let licenseWindow = null;

function targetFile() {
  if (!TRIAL.trial || !TRIAL_STATUS.expired || ACTIVATION.activated) return EDITOR_FILE;
  return TRIAL.requireActivation ? ACTIVATE_FILE : EXPIRED_FILE;
}

// Tytuł okna (górna część ramy) z widocznym odliczaniem wersji demo.
function computeTitle() {
  if (TRIAL.trial && !ACTIVATION.activated && !TRIAL_STATUS.expired) {
    const d = TRIAL_STATUS.daysLeft;
    const word = d === 1 ? 'dzień' : 'dni';
    return APP_TITLE + ' — wersja demo: pozostało ' + d + ' ' + word;
  }
  return APP_TITLE;
}

function applyTitle() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(computeTitle());
}

// Pojedyncza instancja — kolejne uruchomienia tylko aktywują istniejące okno.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b1220',
    title: APP_TITLE,
    show: false,
    autoHideMenuBar: false,
    icon: process.platform === 'linux'
      ? path.join(__dirname, 'build', 'icon.png')
      : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(targetFile());

  mainWindow.once('ready-to-show', () => {
    applyTitle();
    mainWindow.show();
  });

  // Strona edytora ustawia własny document.title — utrzymujemy nasz tytuł
  // z odliczaniem wersji demo w pasku okna.
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    applyTitle();
  });

  // Linki zewnętrzne (target=_blank / window.open) otwieraj w przeglądarce systemowej.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  // Blokuj nawigację poza lokalny plik edytora (bezpieczeństwo).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showLicenseWindow() {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.focus();
    return;
  }
  licenseWindow = new BrowserWindow({
    width: 760,
    height: 720,
    title: 'Umowa licencyjna — ' + APP_TITLE,
    backgroundColor: '#0b1220',
    parent: mainWindow || undefined,
    modal: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  licenseWindow.setMenuBarVisibility(false);
  licenseWindow.loadFile(LICENSE_FILE);
  licenseWindow.on('closed', () => { licenseWindow = null; });
}

function showAbout() {
  let trialLine = '';
  if (TRIAL.trial) {
    if (ACTIVATION.activated) {
      trialLine = '\n\nLicencja aktywowana — kod: ' + ACTIVATION.code;
    } else if (TRIAL_STATUS.expired) {
      trialLine = TRIAL.requireActivation
        ? '\n\nOkres próbny zakończony — wymagany kod aktywacyjny.'
        : '\n\nWersja próbna — okres testowy zakończony.';
    } else {
      trialLine = '\n\nWersja próbna — pozostało dni: ' + TRIAL_STATUS.daysLeft + ' z ' + TRIAL.days + '.';
    }
  }
  const detail =
    'Wersja ' + app.getVersion() + '\n' +
    'Interaktywny edytor projektów do cięcia i grawerowania laserowego.' +
    trialLine + '\n\n' +
    'Copyright © 2026 Xeomsc Laser\n' +
    WEBSITE_URL;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'O programie',
    message: APP_TITLE,
    detail,
    buttons: ['OK', 'Umowa licencyjna', 'Strona WWW'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }).then(({ response }) => {
    if (response === 1) showLicenseWindow();
    else if (response === 2) shell.openExternal(WEBSITE_URL);
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [];

  if (isMac) {
    template.push({
      label: APP_TITLE,
      submenu: [
        { label: 'O programie ' + APP_TITLE, click: showAbout },
        { label: 'Umowa licencyjna…', click: showLicenseWindow },
        { type: 'separator' },
        { role: 'hide', label: 'Ukryj ' + APP_TITLE },
        { role: 'hideOthers', label: 'Ukryj pozostałe' },
        { role: 'unhide', label: 'Pokaż wszystko' },
        { type: 'separator' },
        { role: 'quit', label: 'Zakończ ' + APP_TITLE }
      ]
    });
  }

  template.push({
    label: 'Plik',
    submenu: [
      isMac ? { role: 'close', label: 'Zamknij okno' }
            : { role: 'quit', label: 'Zakończ' }
    ]
  });

  template.push({
    label: 'Edycja',
    submenu: [
      { role: 'undo', label: 'Cofnij' },
      { role: 'redo', label: 'Ponów' },
      { type: 'separator' },
      { role: 'cut', label: 'Wytnij' },
      { role: 'copy', label: 'Kopiuj' },
      { role: 'paste', label: 'Wklej' },
      { role: 'selectAll', label: 'Zaznacz wszystko' }
    ]
  });

  template.push({
    label: 'Widok',
    submenu: [
      { role: 'reload', label: 'Odśwież' },
      { role: 'forceReload', label: 'Wymuś odświeżenie' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Rozmiar domyślny' },
      { role: 'zoomIn', label: 'Powiększ' },
      { role: 'zoomOut', label: 'Pomniejsz' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pełny ekran' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Narzędzia programisty' }
    ]
  });

  const helpSubmenu = [
    { label: 'Strona WWW (xeomsc-laser.pl)', click: () => shell.openExternal(WEBSITE_URL) },
    { label: 'Umowa licencyjna…', click: showLicenseWindow }
  ];
  if (TRIAL.trial && TRIAL.requireActivation && !ACTIVATION.activated) {
    helpSubmenu.push({ type: 'separator' });
    helpSubmenu.push({
      label: 'Aktywuj kod…',
      click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(ACTIVATE_FILE); }
    });
  }
  helpSubmenu.push({ type: 'separator' });
  helpSubmenu.push({ label: 'O programie', click: showAbout });

  template.push({
    label: 'Pomoc',
    role: 'help',
    submenu: helpSubmenu
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('license:activate', async (_event, code) => {
  const result = await license.verifyAndActivate(code, app.getPath('userData'));
  if (result.ok) {
    ACTIVATION = license.getActivation(app.getPath('userData'));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(EDITOR_FILE);
    applyTitle();
  }
  return result;
});

// Status wersji próbnej — używany przez pasek demo i ekran aktywacji.
ipcMain.handle('trial:status', () => ({
  trial: TRIAL.trial,
  requireActivation: TRIAL.requireActivation,
  expired: TRIAL_STATUS.expired,
  daysLeft: TRIAL_STATUS.daysLeft,
  days: TRIAL.days,
  activated: ACTIVATION.activated
}));

// Otwórz ekran aktywacji (można wpisać kod w dowolnym momencie).
ipcMain.handle('nav:activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(ACTIVATE_FILE);
});

// Powrót do edytora z ekranu aktywacji — dozwolony, gdy okres próbny trwa
// (lub program został już aktywowany).
ipcMain.handle('nav:editor', () => {
  if (mainWindow && !mainWindow.isDestroyed() && (!TRIAL_STATUS.expired || ACTIVATION.activated)) {
    mainWindow.loadFile(EDITOR_FILE);
  }
});

app.whenReady().then(() => {
  TRIAL_STATUS = trial.getStatus(app.getPath('userData'), TRIAL, Date.now());
  ACTIVATION = license.getActivation(app.getPath('userData'));
  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  // Sprawdzenie nowej wersji w tle — błędy/sieć brak nie blokują programu.
  updateCheck.checkForUpdate(app.getVersion()).then((latest) => {
    if (!latest || !mainWindow || mainWindow.isDestroyed()) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Nowa wersja dostępna',
      message: APP_TITLE + ' ' + latest.version + ' jest już dostępny.',
      detail: (latest.notes ? latest.notes + '\n\n' : '') + 'Aktualna wersja zainstalowana: ' + app.getVersion(),
      buttons: ['Pobierz', 'Później'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    }).then(({ response }) => {
      if (response === 0) shell.openExternal(latest.url || DOWNLOADS_URL);
    });
  }).catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
