# Så publicerar du portalen (Vercel, Railway, Render)

Så att vänner och spelare kan nå sidan måste du lägga upp den på en tjänst på nätet. Här är två sätt.

---

## 1. Railway eller Render (enklast – rekommenderas)

Dessa tjänster kör din Node-server som vanligt. **Inga kodändringar behövs** – bara ladda upp koden och sätta miljövariabler.

### Krav
- **Databasen** måste vara nåbar från internet. Om MySQL ligger på din dator (HeidiSQL) kan den **inte** nås från Railway/Render. Då behöver du antingen:
  - ett moln-MySQL (t.ex. [PlanetScale](https://planetscale.com), [Railway MySQL](https://railway.app), [Aiven](https://aiven.io)) och flytta/kopiera `users`-tabellen dit, **eller**
  - behålla karaktärsdata lokalt och **inte** sätta `DB_HOST` etc. – då används bara `data/player-stats.json` (utan databas) på den publicerade sidan.

### Railway (kort steg)
1. Skapa konto på [railway.app](https://railway.app).
2. **New Project** → **Deploy from GitHub repo** (koppla ditt repo) eller **Empty project** och deploya med Railway CLI.
3. Lägg till **Environment Variables** (samma som i `.env`):  
   `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, `FIVEM_SERVER_IP`, `FIVEM_SERVER_PORT`, och om du använder moln-MySQL: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, etc.
4. **DISCORD_CALLBACK_URL** måste vara din publicerade URL, t.ex.  
   `https://ditt-projekt.up.railway.app/auth/discord/callback`
5. I Discord Developer Portal → OAuth2 → Redirects: lägg till samma URL.
6. Railway startar automatiskt med `npm start` om `package.json` har `"start": "node server.js"`.

### Render (kort steg)
1. Skapa konto på [render.com](https://render.com).
2. **New** → **Web Service**, koppla ditt Git-repo.
3. **Build command:** `npm install`  
   **Start command:** `npm start`
4. Under **Environment** lägg till samma variabler som i `.env`.  
   **DISCORD_CALLBACK_URL:** `https://ditt-namn.onrender.com/auth/discord/callback`
5. I Discord Developer Portal → OAuth2 → Redirects: lägg till den URL:en.

När det är klart kan du skicka länken (t.ex. `https://ditt-projekt.up.railway.app`) till vänner så kan de logga in med Discord och se dashboarden.

---

## 2. Vercel

Vercel är gjort för serverless. Din app är en vanlig Express-server med sessioner i minnet, så för Vercel behöver du **extra steg** så att inloggningar håller sig mellan anrop:

- **Sessioner:** På Vercel körs koden i korta “funktioner”, så minnessessioner försvinner. Du måste använda en **Redis-databas** (t.ex. [Upstash Redis](https://vercel.com/marketplace/upstash/upstash-redis) via Vercel Marketplace) och sätta `REDIS_URL` (eller de variabler Upstash ger). Projektet har stöd för det – se nedan.
- **Databas:** MySQL måste vara nåbar från internet (samma som för Railway). Lokal HeidiSQL på din dator går inte att använda direkt.

### Steg på Vercel
1. Skapa konto på [vercel.com](https://vercel.com) och koppla ditt Git-repo.
2. **Add Redis:** Vercel → ditt projekt → Storage → Create Database → välj **Upstash Redis** (eller annan Redis). Då får du automatiskt variabler som `KV_REST_API_URL` och `KV_REST_API_TOKEN` (eller `REDIS_URL`).
3. I projektet → **Settings → Environment Variables** lägg till alla från `.env`, inkl.:
   - `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, `FIVEM_SERVER_IP`, `FIVEM_SERVER_PORT`
   - Om du använder moln-MySQL: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, osv.
4. **DISCORD_CALLBACK_URL** ska vara din Vercel-URL, t.ex.  
   `https://ditt-projekt.vercel.app/auth/discord/callback`  
   Lägg också in den i Discord Developer Portal → OAuth2 → Redirects.
5. Deploya. `vercel.json` och `api/index.js` är redan tillagda så att Vercel kör Express-appen som en serverless-funktion.

Om du **inte** sätter Redis-variablerna kommer inloggning att verka ostabilt (användare kan tappa session mellan sidladdningar). Därför rekommenderas **Railway eller Render** om du vill ha minst konfiguration.

---

## Sammanfattning

| Tjänst    | Enkelhet | Sessioner        | MySQL                    |
|----------|----------|------------------|--------------------------|
| Railway  | ⭐⭐⭐     | Fungerar som nu  | Måste vara moln/nåbar    |
| Render   | ⭐⭐⭐     | Fungerar som nu  | Måste vara moln/nåbar    |
| Vercel   | ⭐⭐      | Kräver Redis     | Måste vara moln/nåbar    |

**Rekommendation:** Börja med **Railway** eller **Render**. Sätt alla miljövariabler från `.env` och uppdatera Discord OAuth2 redirect-URL till din publicerade adress. Då kan vänner och spelare nå sidan direkt.
