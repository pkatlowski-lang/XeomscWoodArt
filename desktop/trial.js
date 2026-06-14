'use strict';

/*
 * Logika wersji próbnej. Czas pierwszego uruchomienia jest zapisywany w katalogu
 * danych użytkownika (app.getPath('userData')) — niezależnie od localStorage
 * edytora, żeby wyczyszczenie danych strony nie resetowało licznika.
 */

const fs = require('fs');
const path = require('path');

const DAY_MS = 86400000;
const STATE_FILE = 'trial-state.json';

function loadConfig(dir) {
  try {
    const cfg = require(path.join(dir, 'trial.config.json'));
    return { trial: !!cfg.trial, days: Number(cfg.days) || 7 };
  } catch (e) {
    return { trial: false, days: 7 };
  }
}

function statePath(userDataDir) {
  return path.join(userDataDir, STATE_FILE);
}

function readFirstRun(userDataDir) {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(userDataDir), 'utf8'));
    if (data && typeof data.firstRun === 'number') return data.firstRun;
  } catch (e) {}
  return null;
}

function writeFirstRun(userDataDir, firstRun) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(statePath(userDataDir), JSON.stringify({ firstRun }));
  } catch (e) {}
}

/**
 * Zwraca { expired, daysLeft } dla wersji próbnej (daysLeft=null dla pełnej wersji).
 * Przy pierwszym uruchomieniu zapisuje znacznik czasu; ujemny upływ czasu
 * (np. po przestawieniu zegara systemowego wstecz) traktowany jest jako wygasły.
 */
function getStatus(userDataDir, config, now) {
  now = now || Date.now();
  if (!config.trial) return { expired: false, daysLeft: null };

  let firstRun = readFirstRun(userDataDir);
  if (firstRun === null) {
    firstRun = now;
    writeFirstRun(userDataDir, firstRun);
  }

  const limitMs = config.days * DAY_MS;
  const elapsed = now - firstRun;
  const expired = elapsed < 0 || elapsed > limitMs;
  const daysLeft = Math.max(0, Math.ceil((limitMs - elapsed) / DAY_MS));
  return { expired, daysLeft };
}

module.exports = { DAY_MS, loadConfig, getStatus };
