'use strict';

/*
 * Test dymny (smoke test): uruchamia Electron, ładuje przygotowany edytor,
 * robi zrzut ekranu i zamyka aplikację. Służy do szybkiej weryfikacji, że
 * powłoka desktop poprawnie renderuje edytor (bez crasha). Uruchamiać pod
 * Xvfb:  xvfb-run -a npm run smoke
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const EDITOR = path.join(__dirname, 'app', 'edytor.html');
const OUT = process.env.XEO_SMOKE_OUT || path.join(__dirname, 'smoke.png');
const consoleErrors = [];

// W kontenerze CI/sandbox brak SUID-sandbox i GPU — wymagane tylko do testu.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(message); // 2 = warning, 3 = error
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[smoke] RENDERER PADŁ:', JSON.stringify(details));
    app.exit(1);
  });

  let failed = false;
  try {
    await win.loadFile(EDITOR);
  } catch (err) {
    console.error('[smoke] loadFile NIEUDANE:', err && err.message);
    failed = true;
  }

  // daj czas na render 3D / czcionki
  await new Promise((r) => setTimeout(r, 3000));

  try {
    const img = await win.webContents.capturePage();
    const png = img.toPNG();
    fs.writeFileSync(OUT, png);
    const size = png.length;
    console.log('[smoke] zrzut zapisany:', OUT, '(' + size + ' B)');
    if (size < 5000) {
      console.error('[smoke] zrzut podejrzanie mały — możliwy pusty ekran.');
      failed = true;
    }
  } catch (err) {
    console.error('[smoke] capturePage NIEUDANE:', err && err.message);
    failed = true;
  }

  if (consoleErrors.length) {
    console.log('[smoke] komunikaty konsoli (warn/error), do wglądu:');
    for (const m of consoleErrors.slice(0, 20)) console.log('   • ' + m);
  }

  console.log('[smoke] WYNIK:', failed ? 'NIEUDANY' : 'OK');
  app.exit(failed ? 1 : 0);
});
