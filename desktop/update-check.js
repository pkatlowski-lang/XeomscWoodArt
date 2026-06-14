'use strict';

/*
 * Sprawdzanie dostępności nowej wersji programu.
 *
 * Numer najnowszej wersji jest publikowany w Firestore (projekt xeomsc-licencje,
 * dokument app_config/latest, pole "version" + "downloadUrl") z panelu
 * administracyjnego (admin.html). Odczyt tego dokumentu jest publiczny
 * (reguły Firestore: allow get: if true), więc sprawdzenie nie wymaga
 * logowania. Błędy sieci są wyciszane — brak internetu nie blokuje programu.
 */

const FIREBASE_PROJECT = 'xeomsc-licencje';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

function parseVersion(v) {
  return String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
}

function isNewer(remote, local) {
  const r = parseVersion(remote), l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0, lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

async function fetchLatest() {
  const res = await fetch(`${FIRESTORE_BASE}/app_config/latest`);
  if (!res.ok) return null;
  const doc = await res.json();
  const f = doc.fields || {};
  return {
    version: f.version && f.version.stringValue,
    url: f.downloadUrl && f.downloadUrl.stringValue,
    notes: f.notes && f.notes.stringValue
  };
}

/** Zwraca dane o nowszej wersji ({version,url,notes}) albo null. */
async function checkForUpdate(currentVersion) {
  try {
    const latest = await fetchLatest();
    if (latest && latest.version && isNewer(latest.version, currentVersion)) return latest;
  } catch (e) {}
  return null;
}

module.exports = { checkForUpdate, isNewer, parseVersion };
