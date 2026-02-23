# Fågelviken Roleplay – Portal

Modern, minimal portal för den svenska FiveM-rollspelservern **Fågelviken Roleplay**. Mörkt tema, Discord-inloggning, serverstatus och snabblänkar.

## Funktioner

- **Landingssida** – Hero, tagline, "Logga in med Discord", infokort, footer
- **Discord OAuth2** – Inloggning och redirect till dashboard
- **Dashboard** – Välkomsttext med Discord-användarnamn, serverstatus (online/offline, antal spelare), "Anslut till server" (`fivem://connect/...`), länkar till Regler, Whitelist, Rapporter, Support
- **Serverstatus** – Hämtas från FiveM-servens `dynamic.json` (proxad av appen)
- **Responsiv** – Desktop och mobil
- **Mörk, minimal design** – Skandinavisk stil, Bruno Ace SC-typsnitt

**Vill du att vänner och spelare ska kunna nå sidan?** Se **[DEPLOY.md](DEPLOY.md)** – där beskrivs hur du lägger upp portalen på **Vercel**, **Railway** eller **Render** så att den är tillgänglig på nätet.

---

## Så sätter du upp API:erna

### 1. Discord-inloggning

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications) och skapa en app (**New Application**).
2. Under **OAuth2** → **General**: kopiera **Client ID** och **Client Secret** till `.env` som `DISCORD_CLIENT_ID` och `DISCORD_CLIENT_SECRET`.
3. Under **OAuth2** → **Redirects**: lägg till din callback-URL:
   - Lokalt: `http://localhost:3000/auth/discord/callback`
   - Produktion: `https://din-domän.se/auth/discord/callback`
4. Sätt i `.env`:
   ```env
   DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback
   ```
   (Ändra till din produktion-URL när du går live.)

Efter det kan besökare klicka på "Logga in med Discord" på landningssidan och omdirigeras tillbaka till dashboarden inloggade.

### 2. FiveM-serverstatus

Portalen anropar `http://FIVEM_SERVER_IP:FIVEM_SERVER_PORT/dynamic.json` för att visa online/offline och antal spelare. FiveM exponerar normalt denna endpoint automatiskt.

1. I `.env`, sätt din servers IP eller hostname och port (vanligtvis 30120):
   ```env
   FIVEM_SERVER_IP=play.example.com
   FIVEM_SERVER_PORT=30120
   ```
2. **Viktigt:** Node-servern (portalen) måste kunna nå FiveM-servren på den adressen. Körs båda på samma maskin kan du använda `127.0.0.1` eller `localhost`. Körs FiveM på en annan server, använd dess publika IP eller hostname.

Knappen "Anslut till server" på dashboarden använder automatiskt samma IP och port (`fivem://connect/IP:PORT`).

**Uptime:** Om FiveM inte skickar `uptime` i `dynamic.json`/`info.json` räknar portalen själv från det ögonblick servern först svarar. Uptime nollställs när servern går offline eller när portalen startas om.

### 3. Mina karaktärer & Total speltid

Dashboarden visar **Mina karaktärer** och **Total speltid** från filen `data/player-stats.json`. För att fylla i data:

**Alternativ A – Testa manuellt (utan FiveM-script)**  
Anropa uppdaterings-API:et med din Discord ID (finns t.ex. i Discord utvecklarläge: Högerklicka på dig → Kopiera användar-ID):

```bash
curl -X POST http://localhost:3000/api/player-stats/update ^
  -H "Content-Type: application/json" ^
  -d "{\"discordId\":\"DIN_DISCORD_ID\",\"characterCount\":2,\"totalPlaytimeMinutes\":90}"
```

(Använd `\` för radbrytning i PowerShell; på Mac/Linux använd `\` i slutet av raden och `'{"discordId":"..."}'`.)

Om du satt `PLAYER_STATS_API_KEY` i `.env` måste du skicka samma värde i headern: `-H "X-API-Key: din-nyckel"`.

**Alternativ B – Från FiveM-servern**  
Skriv ett litet script på FiveM-servern som vid t.ex. spelar-koppling/koppling-ner anropar:

`POST http://PORTAL_URL/api/player-stats/update`  
Body: `{ "discordId": "<discord id>", "characterCount": 2, "totalPlaytimeMinutes": 120 }`  
Header: `X-API-Key: <PLAYER_STATS_API_KEY>` (om du har satt den i `.env`).

Datan sparas i `data/player-stats.json` och överlever omstart av portalen.

**Alternativ C – Koppling till er databas (HeidiSQL / ESX Legacy)**  
Om karaktärerna ligger i samma databas som servern (t.ex. **esxlegacy_9572da** och tabellen **users**) kan portalen läsa därifrån. Då behöver du inte anropa `POST /api/player-stats/update` för karaktärslistan – den hämtas utifrån inloggad användares Discord-ID.

Portalen har stöd för er exakta struktur:
- **Namn** från kolumnerna `firstname` och `lastname`
- **Jobb** från kolumnen `job`
- **Pengar** från JSON-kolumnen `accounts` (summan av `bank` och `money`)
- **Speltid** från JSON-kolumnen `metadata` (fältet `lastPlaytime`)

**Viktigt:** Tabellen **users** måste ha en kolumn som anger vilket Discord-ID som äger varje karaktär, annars vet inte portalen vilka rader som ska visas. I många ESX-installationer finns denna kolumn inte från början – då gör du så här:

1. Öppna **HeidiSQL** och anslut till er databas (t.ex. `esxlegacy_9572da`).
2. Kör följande SQL (skapar kolumnen `discord_id` i tabellen `users`):
   ```sql
   ALTER TABLE users ADD COLUMN discord_id VARCHAR(64) DEFAULT NULL;
   ```
3. Sätt värdet från er **FiveM-server** när en spelare är inloggad: uppdatera `users.discord_id` för den karaktär spelaren använder, med spelarens Discord-ID (det ni får från er Discord-identifierare i spelet). Då kan portalen visa rätt karaktärer för rätt användare.

4. I portalen, i `.env`, sätt (anpassa lösenord och ev. databasnamn):
   ```env
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=ditt_lösenord
   DB_DATABASE=esxlegacy_9572da
   DB_TABLE=users
   DB_COLUMN_DISCORD=discord_id
   DB_COLUMN_FIRSTNAME=firstname
   DB_COLUMN_LASTNAME=lastname
   DB_COLUMN_JOB=job
   DB_COLUMN_ACCOUNTS=accounts
   DB_COLUMN_METADATA=metadata
   DB_PLAYTIME_JSON_KEY=lastPlaytime
   ```
5. Starta om portalen. I konsolen ska du se: `MySQL ansluten för karaktärsdata (tabell: users)`.

På dashboarden visas då **Mina karaktärer** (antal) och en lista med kort per karaktär (namn, jobb, pengar, speltid per karaktär). Total speltid är summan av alla karaktärers speltid.

### 4. Valfria länkar (Discord, Regler, Whitelist m.m.)

- **DISCORD_INVITE_URL** – Används i footern på landningssidan och som standardlänk för dashboard-länkarna om du inte sätter egna:
  ```env
  DISCORD_INVITE_URL=https://discord.gg/din-inbjudan
  ```

- **Regler / Whitelist / Rapporter / Support** – Du kan sätta egna URL:er i `.env`. Om de inte sätts används Discord-inbjudan som fallback:
  ```env
  RULES_URL=https://discord.com/channels/...
  WHITELIST_URL=https://din-hemsida.se/whitelist
  REPORTS_URL=https://...
  SUPPORT_URL=https://...
  ```

- **PLAYER_STATS_API_KEY** – Valfri nyckel för att skydda `POST /api/player-stats/update`. Om du sätter den måste FiveM-scriptet (eller dina anrop) skicka samma värde i headern `X-API-Key`. Lämna tom för utveckling.

---

## Snabbstart

```bash
# Kopiera exempel-miljö och fyll i dina värden
cp .env.example .env

# Redigera .env med Discord Client ID/Secret, FiveM IP/port, m.m.

npm install
npm start
```

Öppna [http://localhost:3000](http://localhost:3000). Klicka "Logga in med Discord" för att testa inloggning, och öppna dashboarden för att se serverstatus och anslutningslänk.

---

## Projektstruktur

```
├── server.js           # Express, Discord OAuth, session, /api/me, /api/server-status, /api/config
├── .env.example        # Mall för .env (kopiera till .env)
├── package.json
├── public/
│   ├── index.html      # Landningssida
│   ├── dashboard.html  # Dashboard (kräver inloggning)
│   ├── css/
│   └── js/             # landing.js, dashboard.js
```

## Produktion

- Sätt `NODE_ENV=production`
- Använd en stark `SESSION_SECRET`
- Kör över HTTPS och sätt `DISCORD_CALLBACK_URL` till din riktiga domän
- Överväg reverse proxy (t.ex. nginx) och process manager (t.ex. PM2)
