# Wdrożenie

Aplikacja jedzie w Dockerze na VPS-ie Mikrusa: frontend (nginx z buildem Vite), backend (FastAPI), Postgres, MinIO i Mailpit. Z zewnątrz widać wyłącznie frontend; on proxuje `/api/` do backendu.

## Adres

https://fiszki-14m94kaf77.byst.re — HTTPS zapewnia proxy Mikrusa, certyfikatu nie utrzymujemy sami. Na VPS-ie serwis jedzie czystym HTTP na porcie 8080.

## Serwer

| | |
|---|---|
| Host SSH | `roman164.mikrus.xyz`, port `10164`, użytkownik `root` |
| Klucz SSH | `~/.ssh/mikrus` (osobisty), `github-actions-flashcards-deploy` (CI) |
| Katalog | `/opt/flashcards` — klon repozytorium, gałąź `main` |
| Docker | Docker Engine + plugin compose z repozytorium Dockera |
| Port | 8080, publikowany przez kontener frontendu |

```bash
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz
```

## Konfiguracja produkcyjna

`docker-compose.prod.yml` to nakładka na `docker-compose.yml`. Uruchamiamy zawsze oba pliki naraz:

```bash
cd /opt/flashcards
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
```

Nakładka robi trzy rzeczy:

- zdejmuje publikowane porty z bazy, MinIO, Mailpita i backendu — VPS ma publiczne IPv6, więc `ports:` z pliku deweloperskiego wystawiłoby Postgresa na świat,
- podstawia hasła ze zmiennych środowiskowych zamiast deweloperskich `flashcards`/`flashcards123`,
- zostawia na zewnątrz tylko frontend na 8080.

Sekrety leżą w `/opt/flashcards/.env` (uprawnienia `600`), **poza repozytorium**:

```
POSTGRES_USER=flashcards
POSTGRES_PASSWORD=...        # wygenerowane losowo
POSTGRES_DB=flashcards
MINIO_ROOT_USER=flashcards
MINIO_ROOT_PASSWORD=...      # wygenerowane losowo
```

Opcjonalnie, gdy zamiast Mailpita ma iść prawdziwy SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`.

Sprawdzenie, że nic poza 8080 nie wystaje:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full config | grep published
```

## Poczta

Kody logowania wychodzą przez **Outsidera** — zewnętrzny serwer pocztowy Mikrusa, w cenie abonamentu, bez dodatkowej opłaty. Skrzynka `fiszki@r164.mikr.dev`, wysyłka przez `smtp.r164.mikr.dev:587` ze STARTTLS.

Konfiguracja siedzi w `/opt/flashcards/.env`:

```
SMTP_HOST=smtp.r164.mikr.dev
SMTP_PORT=587
SMTP_FROM=fiszki@r164.mikr.dev
SMTP_USERNAME=fiszki@r164.mikr.dev
SMTP_PASSWORD=...
SMTP_USE_TLS=true
```

Panel skrzynek: https://outsider.mikr.us:2222 (DirectAdmin, login `r164`). Hasło do panelu przyszło mailem przy aktywacji usługi; jest też w logach operacji Mikrusa (`/logs`, wpis `outsider`). Skrzynka ma limit 200 wysłanych wiadomości na dobę i 100 MB quoty.

Założenie kolejnej skrzynki przez API DirectAdmina:

```bash
curl -k -u 'r164:HASLO_PANELU' https://outsider.mikr.us:2222/CMD_API_POP \
  -d action=create -d domain=r164.mikr.dev -d user=nazwa \
  -d passwd=TAJNE -d passwd2=TAJNE -d quota=100 -d limit=200
```

`limit=0` (bez limitu) jest odrzucane — trzeba podać konkretną liczbę.

**Dostarczalność.** Domena `r164.mikr.dev` ma SPF obejmujący Outsidera (`v=spf1 a mx ...`, a rekord `a` wskazuje na `95.217.59.141`, czyli hosta wysyłającego), więc SPF przechodzi. DKIM-a ani DMARC-a **nie ma** — pod `*.mikr.dev` stoi wildcardowy TXT, który zwraca ten sam wpis SPF również pod `_dmarc` i `_domainkey`. Poczta bez DKIM-a bywa u dużych dostawców traktowana podejrzliwie, więc pierwszą wiadomość warto poszukać w spamie i oznaczyć „to nie spam".

Gdyby Gmail zaczął odrzucać: alternatywą jest własna domena z własnym SPF i DKIM (dodana w panelu Outsidera) albo zewnętrzny SMTP, np. konto Google z hasłem aplikacji — wtedy zmieniają się tylko zmienne `SMTP_*` w `.env` i `up -d`.

Mailpit został w stacku jako usługa lokalna, ale nie łapie już poczty aplikacji — backend gada bezpośrednio z Outsiderem. Jego konsola nie jest wystawiona publicznie i nie powinna być.

Test wysyłki z pominięciem aplikacji:

```bash
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'cd /opt/flashcards && set -a && . ./.env && set +a && python3 -c "
import os, smtplib, ssl
from email.message import EmailMessage
m = EmailMessage(); m[\"Subject\"] = \"test\"
m[\"From\"] = os.environ[\"SMTP_FROM\"]; m[\"To\"] = \"ty@gmail.com\"
m.set_content(\"test\")
s = smtplib.SMTP(os.environ[\"SMTP_HOST\"], 587, timeout=30)
s.starttls(context=ssl.create_default_context())
s.login(os.environ[\"SMTP_USERNAME\"], os.environ[\"SMTP_PASSWORD\"])
s.send_message(m); s.quit(); print(\"wyslano\")
"'
```

## CI/CD

| Plik | Kiedy | Co robi |
|---|---|---|
| `.github/workflows/kontrola.yml` | pull request do `main` | ESLint, build Vite, walidacja scalonej konfiguracji compose, kontrola że publikowany jest dokładnie jeden port (8080), build obu obrazów, postawienie całego stacku i sprawdzenie, że frontend zwraca 200, a `/api/sets` bez sesji 401 |
| `.github/workflows/deploy.yml` | push na `main` (albo ręcznie) | SSH na VPS, `git reset --hard origin/main`, `compose up -d --build --wait`, `docker image prune`, weryfikacja z serwera i z zewnątrz |

Wdrożenie ma `concurrency: wdrozenie-produkcja` — dwa naraz nie wystartują.

Sekrety w GitHubie: `VPS_SSH_KEY` (klucz CI, osobny od Twojego), `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_PATH`, `SITE_URL`.

Odcięcie CI od serwera:

```bash
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  "sed -i '/github-actions-flashcards-deploy/d' ~/.ssh/authorized_keys"
```

## Ręcznie, gdy trzeba obejść CI

```bash
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'cd /opt/flashcards && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build'
```

## Kontrola i logi

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fiszki-14m94kaf77.byst.re/

ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'cd /opt/flashcards && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full ps'

ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'cd /opt/flashcards && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full logs --tail 80 backend'
```

## Dane

Postgres i MinIO trzymają dane w wolumenach `flashcards_pg_data` i `flashcards_minio_data`. `compose down` ich nie kasuje, `compose down -v` **kasuje**. Kopii zapasowych na razie nie ma:

```bash
# zrzut bazy na własną maszynę
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'docker exec flashcards-db-1 pg_dump -U flashcards flashcards' > kopia.sql
```

## Subdomena

Podpięta poleceniem `domena` na serwerze (używa `/klucz_api`):

```bash
ssh -i ~/.ssh/mikrus -p 10164 root@roman164.mikrus.xyz \
  'domena fiszki-14m94kaf77.byst.re 8080'
```

Coś musi odpowiadać na `localhost:8080` **przed** wywołaniem — inaczej skrypt odmówi. API Mikrusa nie ma usuwania domen; odpięcie idzie przez panel mikr.us.
