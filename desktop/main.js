'use strict';

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const APP_TITLE = 'Xeomsc-Laser';
const WEBSITE_URL = 'https://xeomsc-laser.pl';
const EDITOR_FILE = path.join(__dirname, 'app', 'edytor.html');
const LICENSE_FILE = path.join(__dirname, 'app', 'license.html');

let mainWindow = null;
let licenseWindow = null;

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

  mainWindow.loadFile(EDITOR_FILE);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
  const detail =
    'Wersja ' + app.getVersion() + '\n' +
    'Interaktywny edytor projektów do cięcia i grawerowania laserowego.\n\n' +
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

  template.push({
    label: 'Pomoc',
    role: 'help',
    submenu: [
      { label: 'Strona WWW (xeomsc-laser.pl)', click: () => shell.openExternal(WEBSITE_URL) },
      { label: 'Umowa licencyjna…', click: showLicenseWindow },
      { type: 'separator' },
      { label: 'O programie', click: showAbout }
    ]
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
