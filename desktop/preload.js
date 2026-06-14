'use strict';

// Minimalny, bezpieczny most. Edytor nie wymaga API Node, ale udostępniamy
// kilka informacji o aplikacji oraz funkcje licencji/aktywacji.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xeoDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    app: process.env.npm_package_version || null,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  activate: (code) => ipcRenderer.invoke('license:activate', code),
  trialStatus: () => ipcRenderer.invoke('trial:status'),
  openActivate: () => ipcRenderer.invoke('nav:activate'),
  backToEditor: () => ipcRenderer.invoke('nav:editor')
});

// Pasek wersji próbnej u góry edytora: pokazuje pozostały czas demo i — w
// wersji z licencją — przycisk do wpisania kodu aktywacyjnego w dowolnym
// momencie (jeszcze przed zakończeniem okresu próbnego). Pasek dokładamy
// jako pierwszy element kontenera .app (układ flex sam zmieści resztę),
// więc nie zasłania narzędzi edytora.
window.addEventListener('DOMContentLoaded', async () => {
  const appEl = document.querySelector('.app');
  if (!appEl) return; // nie jesteśmy na ekranie edytora

  let st;
  try { st = await ipcRenderer.invoke('trial:status'); } catch (e) { return; }
  if (!st || !st.trial || st.activated || st.expired) return;

  const d = st.daysLeft;
  const dayWord = d === 1 ? 'dzień' : 'dni';

  const bar = document.createElement('div');
  bar.id = 'xeo-trial-bar';
  bar.style.cssText =
    'flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:14px;' +
    'height:34px;background:linear-gradient(135deg,#f7b733,#e0892a);color:#1a1304;' +
    "font:600 13px/1 -apple-system,'Segoe UI',Roboto,sans-serif;" +
    'padding:0 14px;box-shadow:0 1px 6px rgba(0,0,0,.35);z-index:50';

  const label = document.createElement('span');
  label.textContent = 'Wersja demo — pozostało ' + d + ' ' + dayWord + ' do końca okresu próbnego.';
  bar.appendChild(label);

  if (st.requireActivation) {
    const btn = document.createElement('button');
    btn.textContent = 'Wpisz kod aktywacyjny';
    btn.style.cssText =
      'cursor:pointer;border:none;border-radius:6px;padding:6px 14px;' +
      'background:#1a1304;color:#f7b733;font-weight:700;font-size:12px;white-space:nowrap';
    btn.addEventListener('click', () => ipcRenderer.invoke('nav:activate'));
    bar.appendChild(btn);
  }

  appEl.insertBefore(bar, appEl.firstChild);
});
