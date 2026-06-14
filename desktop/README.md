# Xeomsc-Laser — wersja desktop (do instalacji)

Aplikacja desktopowa (Electron) opakowująca interaktywny edytor projektów
laserowych (`edytor.html`) w program instalowalny na **Windows** i **macOS**,
z umową licencyjną (EULA) wyświetlaną podczas instalacji oraz dostępną w menu
**Pomoc → Umowa licencyjna**.

## Czym różni się od wersji webowej

Wersja instalacyjna **nie zawiera** funkcji „Wyślij projekt do wyceny"
(formularz wysyłki do pracowni + backend Firebase). Edytor działa lokalnie;
projektowanie i podgląd 3D są w pełni offline (czcionki Google pobierane są z
sieci, a w trybie offline stosowane są kroje zastępcze). Usuwanie tej funkcji z
kopii edytora wykonuje skrypt `copy-app.js` podczas builda — plik źródłowy
`../edytor.html` (strona WWW) pozostaje nienaruszony.

## Struktura

```
desktop/
  package.json        konfiguracja aplikacji i electron-builder
  main.js             proces główny Electron (okno, menu PL, licencja, „O programie")
  preload.js          bezpieczny most (contextIsolation)
  copy-app.js         przygotowuje app/ (kopia edytora bez wysyłki + licencja)
  smoke-main.cjs      test dymny (zrzut ekranu w Xvfb)
  LICENSE.txt         EULA (używana też jako ekran licencji w instalatorze NSIS)
  build/
    icon.ico          ikona Windows
    icon.icns         ikona macOS
    icon.png          ikona Linux / źródło
    entitlements.mac.plist
  app/                generowany podczas builda (w .gitignore)
```

## Wymagania

- Node.js 18+ i npm
- Instalator **Windows .exe** buduje się na Windows; **macOS .dmg** na macOS.
  (Cross-build z Linuksa wymagałby Wine/macOS, dlatego oficjalne instalatory
  powstają w GitHub Actions — patrz niżej.)

## Uruchomienie w trybie deweloperskim

```bash
cd desktop
npm install
npm start
```

## Budowanie instalatorów lokalnie

```bash
# Na Windows:
npm run dist:win      # → dist/Xeomsc-Laser-Setup-<wersja>.exe

# Na macOS:
npm run dist:mac      # → dist/Xeomsc-Laser-<wersja>-<arch>.dmg

# Na Linux (pomocniczo, AppImage):
npm run dist:linux
```

## Wersja próbna (7 dni)

Oprócz wersji pełnej można zbudować wersję próbną, która działa **7 dni od
pierwszego uruchomienia** — po tym czasie edytor jest zastępowany ekranem
informacyjnym (`trial-expired.html`) z odnośnikiem do strony WWW.

```bash
npm run dist:win:trial    # → dist/Xeomsc-Laser-PROBA-7dni-<wersja>.exe
npm run dist:mac:trial    # → dist/Xeomsc-Laser-PROBA-7dni-<wersja>-<arch>.dmg
```

Mechanizm:

- `set-trial.js on|off` zapisuje `trial.config.json` (`{ "trial": true, "days": 7 }`
  dla wersji próbnej, `{ "trial": false }` dla pełnej — wersja pełna jest
  domyślna).
- `trial.js` przy starcie programu zapisuje datę pierwszego uruchomienia w
  katalogu danych użytkownika (niezależnie od localStorage edytora) i sprawdza,
  czy minęło więcej niż `days` dni.
- Workflow GitHub Actions (`build-desktop.yml`) buduje automatycznie obie
  wersje (pełną i próbną) dla Windows i macOS.

## Budowanie w chmurze (GitHub Actions) — zalecane

Workflow `.github/workflows/build-desktop.yml` buduje instalatory dla Windows
i macOS na odpowiednich systemach:

- **automatycznie** po każdym pushu zmian w `desktop/**`,
- **ręcznie** z zakładki *Actions → Build Desktop Installers → Run workflow*,
- przy tagu `v*` dodatkowo tworzy **Release** z instalatorami do pobrania.

Gotowe pliki znajdziesz w sekcji *Artifacts* danego uruchomienia workflow
(lub w *Releases*, jeśli zbudowano z tagu).

## Podpisywanie kodu (opcjonalnie, zalecane produkcyjnie)

Instalatory budowane bez certyfikatów są **niepodpisane** — Windows pokaże
SmartScreen, a macOS Gatekeeper komunikat „nieznany deweloper". Aby podpisać:

- **Windows:** ustaw sekrety `CSC_LINK` (certyfikat .pfx, base64) i `CSC_KEY_PASSWORD`.
- **macOS:** ustaw `CSC_LINK`/`CSC_KEY_PASSWORD` (certyfikat Developer ID) oraz
  dane do notaryzacji (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

electron-builder automatycznie wykorzysta te zmienne środowiskowe.
