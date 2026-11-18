# Xeomsc Laser • portfolio i panel pracowni

## Uruchomienie na komputerze

Zainstaluj Node.js 24 LTS. W katalogu `portfolio-studio` uruchom `node server.mjs`. Na Windows możesz również kliknąć `Start.cmd`. Otwórz http://127.0.0.1:4180. Wejście do panelu jest w stopce oraz pod http://127.0.0.1:4180/admin. Domyślne lokalne dane logowania to **admin / admin**. W tym trybie serwer przyjmuje połączenia wyłącznie z komputera użytkownika. Dane pozostają na dysku również po restarcie.

## Obsługa

* Galeria — wybierz do 12 zdjęć lub przeciągnij je do formularza. Przeglądarka przygotuje mniejsze wersje. Przesuń najlepsze zdjęcie na początek, aby ustawić okładkę. Zapisz jako szkic albo zaznacz widoczność w portfolio. Wyróżnienie przenosi projekt na początek.
* Rozmowy — klient pyta o wybraną realizację i dostaje prywatny link. Zapisuje go i wraca po odpowiedź. W panelu właściciel czyta wiadomość i odpowiada w tej samej rozmowie. Klient widzi nowe odpowiedzi po odświeżeniu lub automatycznie w ciągu około 15 sekund. Adres e-mail jest dostępny właścicielowi do kontaktu. Program nie wysyła powiadomień e-mail. Link lokalny działa tylko na komputerze, na którym uruchomiono serwer.
* Wycena — szerokość × wysokość × liczba sztuk wyznaczają powierzchnię. Koszt proporcjonalny do powierzchni arkusza, czas pracy lasera i dodatki składają się na kwotę całkowitą. Cena arkusza i stawka są edytowalne. To oszacowanie bez optymalizacji rozkroju, prowizji i podatków. Z poziomu rozmowy kliknij „Policz wycenę”, a następnie „Wstaw wycenę do odpowiedzi”. Wiadomość wysyłasz osobnym przyciskiem.
* Dwie startowe realizacje to wizualizacje projektów pracowni. Można zastąpić je własnymi zdjęciami. Dotychczasowy katalog Firebase nie jest automatycznie importowany.

## Hosting

Aplikacja działa jako pojedynczy serwer Node.js z SQLite. GitHub Pages sam obsługuje wyłącznie statyczne pliki. Do udostępnienia funkcji klientom potrzebny jest hosting uruchamiający Node.js 24, trwały dysk oraz HTTPS. Ustaw HOST=0.0.0.0, PORT, DATA_DIR na trwałym dysku oraz ADMIN_PASSWORD w sekretach hostingu (co najmniej 14 znaków). Login jest równy admin. Umieść serwer za reverse proxy z HTTPS i zachowaj nagłówek Host. Tryb lokalny z domyślnym hasłem nie powinien być wystawiany przez tunel ani proxy. Limit formularzy jest liczony według adresu faktycznego połączenia — za proxy wszyscy klienci mogą współdzielić limit. Przed uruchomieniem na domenie uzupełnij informację o przetwarzaniu danych zgodnie z konfiguracją swojej firmy i hostingu.

Baza `data/studio.sqlite` obejmuje zdjęcia, realizacje i prywatne rozmowy. Wykonuj kopię całego DATA_DIR przy zatrzymanym serwerze albo używaj kopii online SQLite. Restart unieważnia sesje administratora. Baza, hasło i wiadomości nie należą do repozytorium.

