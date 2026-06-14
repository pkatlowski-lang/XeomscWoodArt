'use strict';

/*
 * Przełącza desktop/trial.config.json między wersją próbną (7 dni) i pełną.
 * Używane przez skrypty npm przed budową instalatora:
 *   node set-trial.js on   -> wersja próbna
 *   node set-trial.js off  -> wersja pełna (domyślna)
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'trial.config.json');
const mode = (process.argv[2] || '').toLowerCase();

const CONFIGS = {
  on: { trial: true, days: 7 },
  trial: { trial: true, days: 7 },
  off: { trial: false, days: 7 },
  full: { trial: false, days: 7 }
};

const config = CONFIGS[mode];
if (!config) {
  console.error('[set-trial] Użycie: node set-trial.js on|off');
  process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log('[set-trial] ' + (config.trial ? `WERSJA PRÓBNA (${config.days} dni)` : 'WERSJA PEŁNA') + ' -> ' + OUT);
