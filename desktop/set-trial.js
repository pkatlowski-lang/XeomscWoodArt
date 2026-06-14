'use strict';

/*
 * Przełącza desktop/trial.config.json między trzema wariantami budowy:
 *   node set-trial.js off       -> wersja bez ograniczeń (do developmentu)
 *   node set-trial.js demo      -> wersja demo: 7 dni, potem ekran "okres
 *                                   próbny zakończony" (bez możliwości aktywacji)
 *   node set-trial.js licensed  -> sprzedawana wersja: 7 dni, potem ekran
 *                                   aktywacji kodem (program odblokowuje się
 *                                   na trwałe po wpisaniu poprawnego kodu)
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'trial.config.json');
const mode = (process.argv[2] || '').toLowerCase();

const CONFIGS = {
  off: { trial: false, days: 7, requireActivation: false },
  full: { trial: false, days: 7, requireActivation: false },
  on: { trial: true, days: 7, requireActivation: false },
  trial: { trial: true, days: 7, requireActivation: false },
  demo: { trial: true, days: 7, requireActivation: false },
  licensed: { trial: true, days: 7, requireActivation: true }
};

const config = CONFIGS[mode];
if (!config) {
  console.error('[set-trial] Użycie: node set-trial.js off|demo|licensed');
  process.exit(1);
}

fs.writeFileSync(OUT, JSON.stringify(config, null, 2) + '\n', 'utf8');

let label = 'WERSJA BEZ OGRANICZEŃ';
if (config.trial && config.requireActivation) label = `WERSJA Z LICENCJĄ (${config.days} dni próby, potem kod aktywacyjny)`;
else if (config.trial) label = `WERSJA DEMO (${config.days} dni)`;

console.log('[set-trial] ' + label + ' -> ' + OUT);
