'use strict';

/*
 * Przygotowuje katalog ./app dla aplikacji desktop:
 *   1. kopiuje ../edytor.html (z głównego repo) i USUWA z tej kopii funkcję
 *      „Wyślij projekt do wyceny" (przyciski, modal i moduł Firebase) — wersja
 *      instalacyjna działa lokalnie i nie zawiera prywatnego backendu pracowni.
 *   2. generuje app/license.html z treści LICENSE.txt (do okna „Umowa licencyjna").
 *
 * Każde usunięcie jest asercjonowane — jeśli struktura edytora się zmieni i
 * markera nie da się znaleźć, build celowo przerwie z błędem (brak cichego dryfu).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_EDITOR = path.join(ROOT, 'edytor.html');
const APP_DIR = path.join(__dirname, 'app');
const OUT_EDITOR = path.join(APP_DIR, 'edytor.html');
const LICENSE_SRC = path.join(__dirname, 'LICENSE.txt');
const OUT_LICENSE_HTML = path.join(APP_DIR, 'license.html');
const OUT_LICENSE_TXT = path.join(APP_DIR, 'license.txt');

function fail(msg) {
  console.error('\n[copy-app] BŁĄD: ' + msg + '\n');
  process.exit(1);
}

/** Wycina zbalansowany blok <div ...>…</div> zaczynający się na startIdx. */
function cutBalancedDiv(html, startIdx) {
  const openRe = /<div\b/gi;
  const closeRe = /<\/div\s*>/gi;
  let depth = 0;
  let i = startIdx;
  // Skanuj sekwencyjnie znaczniki div od startIdx do zbilansowania.
  const re = /<div\b|<\/div\s*>/gi;
  re.lastIndex = startIdx;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) {
        const end = m.index + m[0].length;
        return html.slice(0, startIdx) + html.slice(end);
      }
    } else {
      depth++;
    }
  }
  fail('Nie znaleziono domknięcia <div> dla bloku zaczynającego się na pozycji ' + startIdx);
}

function removeButtonById(html, id) {
  const re = new RegExp('[\\t ]*<button\\b[^>]*\\bid="' + id + '"[\\s\\S]*?<\\/button>\\s*\\n?', 'i');
  if (!re.test(html)) fail('Nie znaleziono przycisku id="' + id + '" do usunięcia.');
  return html.replace(re, '');
}

function removeDivContainingId(html, id, label) {
  const idIdx = html.indexOf('id="' + id + '"');
  if (idIdx === -1) fail('Nie znaleziono elementu id="' + id + '" (' + label + ').');
  const divStart = html.lastIndexOf('<div', idIdx);
  if (divStart === -1) fail('Nie znaleziono otwierającego <div> dla id="' + id + '" (' + label + ').');
  return cutBalancedDiv(html, divStart);
}

function removeFirebaseModule(html) {
  const re = /[\t ]*<script type="module">[\s\S]*?<\/script>\s*\n?/i;
  const m = html.match(re);
  if (!m) fail('Nie znaleziono modułu <script type="module"> (Firebase).');
  if (!/firebasejs/i.test(m[0])) fail('Moduł <script type="module"> nie wygląda na moduł Firebase — przerwano dla bezpieczeństwa.');
  return html.replace(re, '');
}

function buildLicenseHtml(text) {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8">
<title>Umowa licencyjna — Xeomsc-Laser</title>
<style>
  :root{color-scheme:dark}
  html,body{margin:0;background:#0b1220;color:#e6edf6;
    font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:760px;margin:0 auto;padding:28px 30px 60px}
  h1{font-size:18px;margin:0 0 14px;color:#7dd3fc}
  pre{white-space:pre-wrap;word-wrap:break-word;font:13px/1.65 ui-monospace,Consolas,monospace;
    background:#0f1830;border:1px solid #1e2b48;border-radius:10px;padding:18px 20px;margin:0}
</style></head>
<body><div class="wrap">
  <h1>Umowa licencyjna użytkownika końcowego</h1>
  <pre>${esc}</pre>
</div></body></html>`;
}

function main() {
  if (!fs.existsSync(SRC_EDITOR)) fail('Brak pliku źródłowego edytora: ' + SRC_EDITOR);
  if (!fs.existsSync(LICENSE_SRC)) fail('Brak pliku licencji: ' + LICENSE_SRC);

  fs.mkdirSync(APP_DIR, { recursive: true });

  let html = fs.readFileSync(SRC_EDITOR, 'utf8');
  const before = html.length;

  // 1) przycisk „Wyślij do wyceny" w widżecie wyceny na żywo
  html = removeButtonById(html, 'lqSend');
  // 2) przycisk „Wyślij projekt do wyceny" w oknie Wyceny (razem z jego polem)
  html = removeDivContainingId(html, 'sendQuoteOpenBtn', 'pole z przyciskiem wysyłki w modalu Wyceny');
  // 3) całe okno formularza wysyłki do pracowni
  html = removeDivContainingId(html, 'modalSendQuote', 'modal formularza wysyłki');
  // 4) moduł Firebase obsługujący wysyłkę
  html = removeFirebaseModule(html);

  if (/id="lqSend"|id="sendQuoteOpenBtn"|id="modalSendQuote"|firebasejs/i.test(html)) {
    fail('Po usuwaniu wciąż wykryto pozostałości funkcji wysyłki — przerwano.');
  }

  fs.writeFileSync(OUT_EDITOR, html, 'utf8');

  // Logo do brandingu w aplikacji (edytor.html odwołuje się do assets/logo.png)
  try{
    const logoSrc=path.join(ROOT,'assets','logo.png');
    if(fs.existsSync(logoSrc)){
      fs.mkdirSync(path.join(APP_DIR,'assets'),{recursive:true});
      fs.copyFileSync(logoSrc, path.join(APP_DIR,'assets','logo.png'));
    }else{
      console.warn('[copy-app] UWAGA: brak ../assets/logo.png — logo nie zostanie dołączone.');
    }
  }catch(e){ console.warn('[copy-app] logo nieskopiowane:', e.message); }

  // licencja → app/
  const licText = fs.readFileSync(LICENSE_SRC, 'utf8');
  fs.writeFileSync(OUT_LICENSE_TXT, licText, 'utf8');
  fs.writeFileSync(OUT_LICENSE_HTML, buildLicenseHtml(licText), 'utf8');

  const removed = before - html.length;
  console.log('[copy-app] OK — edytor przygotowany (usunięto funkcję wysyłki, ~' + removed + ' znaków).');
  console.log('[copy-app]   ' + OUT_EDITOR);
  console.log('[copy-app]   ' + OUT_LICENSE_HTML);
}

main();
