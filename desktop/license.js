'use strict';

/*
 * Aktywacja kodem licencyjnym po zakończeniu okresu próbnego.
 *
 * Weryfikacja i aktywacja kodu odbywa się przez REST API Firestore (ten sam
 * projekt Firebase co edytor WWW: xeomsc-a8edd) — wymaga to internetu tylko
 * raz, przy aktywacji. Po udanej aktywacji stan zapisywany jest lokalnie
 * (license-state.json w katalogu danych użytkownika) i program działa dalej
 * w pełni offline.
 *
 * Kody są generowane w panelu administracyjnym (admin.html) i zapisywane w
 * kolekcji Firestore "licenses" jako dokumenty {status, createdAt, ...}.
 * Aktywacja zmienia status z "unused" na "activated" i przypisuje kod do
 * identyfikatora urządzenia (deviceId), co blokuje ponowne użycie tego
 * samego kodu na innym komputerze.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = 'license-state.json';
const DEVICE_FILE = 'device-id.json';

const FIREBASE_API_KEY = 'AIzaSyDeRtreUSAmNWvhZm2_Fkt9OcpWs07PrVw';
const FIREBASE_PROJECT = 'xeomsc-a8edd';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';

function statePath(userDataDir) {
  return path.join(userDataDir, STATE_FILE);
}

function devicePath(userDataDir) {
  return path.join(userDataDir, DEVICE_FILE);
}

function getActivation(userDataDir) {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(userDataDir), 'utf8'));
    if (data && data.activated === true && typeof data.code === 'string') return data;
  } catch (e) {}
  return { activated: false, code: null };
}

function setActivation(userDataDir, code) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(statePath(userDataDir), JSON.stringify({ activated: true, code, activatedAt: Date.now() }));
}

function getDeviceId(userDataDir) {
  try {
    const data = JSON.parse(fs.readFileSync(devicePath(userDataDir), 'utf8'));
    if (data && typeof data.id === 'string') return data.id;
  } catch (e) {}
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(devicePath(userDataDir), JSON.stringify({ id }));
  } catch (e) {}
  return id;
}

async function signInAnonymously() {
  const res = await fetch(`${IDENTITY_BASE}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) throw new Error('auth-failed');
  return data.idToken;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Weryfikuje kod licencyjny w Firestore i — jeśli jest nieużyty — aktywuje go
 * (przypisuje do tego urządzenia). Zwraca { ok:true } albo { ok:false, error }.
 */
async function verifyAndActivate(code, userDataDir) {
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9-]{8,40}$/.test(normalized)) {
    return { ok: false, error: 'Nieprawidłowy format kodu.' };
  }

  let idToken;
  try {
    idToken = await signInAnonymously();
  } catch (e) {
    return { ok: false, error: 'Brak połączenia z serwerem aktywacji. Sprawdź internet i spróbuj ponownie.' };
  }

  const deviceId = getDeviceId(userDataDir);
  const docUrl = `${FIRESTORE_BASE}/licenses/${encodeURIComponent(normalized)}`;
  const headers = { Authorization: `Bearer ${idToken}` };

  let getRes;
  try {
    getRes = await fetch(docUrl, { headers });
  } catch (e) {
    return { ok: false, error: 'Brak połączenia z serwerem aktywacji. Sprawdź internet i spróbuj ponownie.' };
  }

  if (getRes.status === 404) {
    return { ok: false, error: 'Kod nieprawidłowy lub nie istnieje.' };
  }
  if (!getRes.ok) {
    return { ok: false, error: 'Błąd serwera aktywacji (' + getRes.status + ').' };
  }

  const doc = await getRes.json();
  const fields = doc.fields || {};
  const status = fields.status && fields.status.stringValue;
  const existingDevice = fields.deviceId && fields.deviceId.stringValue;

  if (status === 'activated') {
    if (existingDevice && existingDevice === deviceId) {
      setActivation(userDataDir, normalized);
      return { ok: true };
    }
    return { ok: false, error: 'Ten kod został już wykorzystany na innym urządzeniu.' };
  }
  if (status !== 'unused') {
    return { ok: false, error: 'Kod nieprawidłowy lub nieaktywny.' };
  }

  const updateMask = 'updateMask.fieldPaths=status&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=deviceId';
  let patchRes;
  try {
    patchRes = await fetch(`${docUrl}?${updateMask}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: 'activated' },
          activatedAt: { timestampValue: new Date().toISOString() },
          deviceId: { stringValue: deviceId }
        }
      })
    });
  } catch (e) {
    return { ok: false, error: 'Brak połączenia z serwerem aktywacji. Sprawdź internet i spróbuj ponownie.' };
  }

  if (!patchRes.ok) {
    return { ok: false, error: 'Nie udało się aktywować kodu (błąd ' + patchRes.status + ').' };
  }

  setActivation(userDataDir, normalized);
  return { ok: true };
}

module.exports = { getActivation, setActivation, verifyAndActivate, getDeviceId, normalizeCode };
