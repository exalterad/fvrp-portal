/**
 * Fågelviken Roleplay – Portal server
 * Express app with Discord OAuth2 and FiveM server status API.
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Valfri MySQL-koppling (HeidiSQL / MariaDB) för karaktärer
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_DATABASE = process.env.DB_DATABASE;
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const DB_TABLE = process.env.DB_TABLE || 'characters';
const DB_COLUMN_DISCORD = process.env.DB_COLUMN_DISCORD || 'discord_id';
const DB_COLUMN_NAME = process.env.DB_COLUMN_NAME || 'name';
const DB_COLUMN_FIRSTNAME = process.env.DB_COLUMN_FIRSTNAME || '';
const DB_COLUMN_LASTNAME = process.env.DB_COLUMN_LASTNAME || '';
const DB_COLUMN_JOB = process.env.DB_COLUMN_JOB || 'job';
const DB_COLUMN_MONEY = process.env.DB_COLUMN_MONEY || 'money';
const DB_COLUMN_ACCOUNTS = process.env.DB_COLUMN_ACCOUNTS || '';
const DB_COLUMN_PLAYTIME = process.env.DB_COLUMN_PLAYTIME || 'playtime_minutes';
const DB_COLUMN_METADATA = process.env.DB_COLUMN_METADATA || '';
const DB_PLAYTIME_JSON_KEY = process.env.DB_PLAYTIME_JSON_KEY || 'lastPlaytime';
const DB_PLAYTIME_UNIT = (process.env.DB_PLAYTIME_UNIT || 'minutes').toLowerCase();
const USE_DB = DB_HOST && DB_USER && DB_DATABASE;
let mysqlPool = null;
if (USE_DB) {
  try {
    const mysql = require('mysql2/promise');
    const port = Number.isFinite(DB_PORT) ? DB_PORT : 3306;
    mysqlPool = mysql.createPool({
      host: DB_HOST,
      port,
      user: DB_USER,
      password: DB_PASSWORD || undefined,
      database: DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    console.log('MySQL karaktärer: ansluten till', DB_HOST + ':' + port + '/' + DB_DATABASE);
  } catch (e) {
    console.warn('MySQL kunde inte laddas:', e.message);
    mysqlPool = null;
  }
} else {
  console.log('MySQL karaktärer: inte konfigurerad (sätt DB_HOST, DB_USER, DB_DATABASE)');
}
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'fvrp-dev-secret-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/discord/callback`;
const FIVEM_IP = process.env.FIVEM_SERVER_IP || 'localhost';
const FIVEM_PORT = process.env.FIVEM_SERVER_PORT || '30120';

// Bakom Railway/nginx etc.: så att cookies och HTTPS fungerar
app.set('trust proxy', 1);

// Uptime: spåra när servern först sågs online (om FiveM inte skickar uptime)
let serverUpSince = null;

// Spelarstatistik: filbaserad lagring (data/player-stats.json)
const DATA_DIR = path.join(__dirname, 'data');
const PLAYER_STATS_FILE = path.join(DATA_DIR, 'player-stats.json');

function loadPlayerStatsStore() {
  try {
    const raw = fs.readFileSync(PLAYER_STATS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function savePlayerStatsStore(store) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYER_STATS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Kunde inte spara player-stats:', e.message);
  }
}

// Session config
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Build Discord OAuth2 authorize URL
function getDiscordAuthUrl() {
  const base = 'https://discord.com/api/oauth2/authorize';
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: 'code',
    scope: 'identify',
  });
  return `${base}?${params.toString()}`;
}

// Exchange code for token and fetch user
async function discordExchangeCode(code) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_CALLBACK_URL,
  });
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) throw new Error('Discord token exchange failed');
  const tokenData = await tokenRes.json();

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) throw new Error('Discord user fetch failed');
  const user = await userRes.json();
  return { id: user.id, username: user.username, avatar: user.avatar };
}

// ——— Routes ———

// Landing page
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard (require login; redirect to landing if no session)
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start Discord login
app.get('/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).send('Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.');
  }
  res.redirect(getDiscordAuthUrl());
});

// Discord OAuth callback
app.get('/auth/discord/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?error=discord_denied');
  if (!code) return res.redirect('/?error=no_code');
  try {
    const user = await discordExchangeCode(code);
    req.session.user = user;
    return res.redirect('/dashboard');
  } catch (e) {
    console.error('Discord OAuth error:', e);
    return res.redirect('/?error=auth_failed');
  }
});

// Current user (for dashboard)
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// FiveM server status (proxied to avoid CORS; server fetches dynamic.json + info.json)
app.get('/api/server-status', async (req, res) => {
  const connectLink = `fivem://connect/${FIVEM_IP}:${FIVEM_PORT}`;
  const now = Date.now();
  try {
    const [dynamicRes, infoRes] = await Promise.all([
      fetch(`http://${FIVEM_IP}:${FIVEM_PORT}/dynamic.json`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
      fetch(`http://${FIVEM_IP}:${FIVEM_PORT}/info.json`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
    ]);
    const data = dynamicRes?.ok ? await dynamicRes.json() : {};
    const info = infoRes?.ok ? await infoRes.json().catch(() => ({})) : {};
    const players = data.clients ?? data.players ?? data.numClients ?? info.clients ?? 0;
    const maxPlayers = data.sv_maxclients ?? data.maxPlayers ?? data.sv_maxClients ?? info.sv_maxclients ?? 32;
    const hostname = data.hostname ?? data.SvHostname ?? info.hostname ?? 'Fågelviken RP';
    let uptimeSeconds = data.uptime ?? info.uptime ?? data.serverUptime ?? null;
    uptimeSeconds = uptimeSeconds != null ? Number(uptimeSeconds) : null;
    if (typeof uptimeSeconds !== 'number' || isNaN(uptimeSeconds) || uptimeSeconds < 0) {
      uptimeSeconds = null;
    }
    if (serverUpSince == null) serverUpSince = now;
    if (uptimeSeconds == null) {
      uptimeSeconds = Math.floor((now - serverUpSince) / 1000);
    }
    res.json({
      online: true,
      players: Number(players) || 0,
      maxPlayers: Number(maxPlayers) || 32,
      hostname,
      connectLink,
      uptimeSeconds,
    });
  } catch (e) {
    serverUpSince = null;
    res.json({
      online: false,
      players: 0,
      maxPlayers: 32,
      hostname: 'Fågelviken RP',
      connectLink,
      uptimeSeconds: null,
    });
  }
});

// Spelarstatistik: från MySQL om konfigurerat, annars data/player-stats.json
// Returnerar alltid: { characters: [ { name, job, money, playtimeMinutes }, ... ], totalPlaytimeMinutes }
app.get('/api/player-stats', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const discordId = req.session.user.id;
  if (mysqlPool) {
    try {
      const safeId = (s) => (typeof s === 'string' && /^[a-zA-Z0-9_]+$/.test(s) ? s : null);
      const table = safeId(DB_TABLE);
      const colDiscord = safeId(DB_COLUMN_DISCORD);
      const colJob = safeId(DB_COLUMN_JOB);
      const useFirstLast = DB_COLUMN_FIRSTNAME && DB_COLUMN_LASTNAME;
      const colFirst = useFirstLast ? safeId(DB_COLUMN_FIRSTNAME) : null;
      const colLast = useFirstLast ? safeId(DB_COLUMN_LASTNAME) : null;
      const colName = !useFirstLast ? safeId(DB_COLUMN_NAME) : null;
      const useAccountsJson = !!DB_COLUMN_ACCOUNTS;
      const colAccounts = useAccountsJson ? safeId(DB_COLUMN_ACCOUNTS) : null;
      const colMoney = !useAccountsJson ? safeId(DB_COLUMN_MONEY) : null;
      const useMetadataPlaytime = !!DB_COLUMN_METADATA && !!DB_PLAYTIME_JSON_KEY;
      const colMetadata = useMetadataPlaytime ? safeId(DB_COLUMN_METADATA) : null;
      const colPlaytime = !useMetadataPlaytime ? safeId(DB_COLUMN_PLAYTIME) : null;

      if (!table || !colDiscord || !colJob) {
        console.log('MySQL karaktärer: saknade tabell/kolumn-konfig');
        return res.json({ characters: [], totalPlaytimeMinutes: 0 });
      }
      if (!useFirstLast && !colName) return res.json({ characters: [], totalPlaytimeMinutes: 0 });
      if (!useAccountsJson && !colMoney) return res.json({ characters: [], totalPlaytimeMinutes: 0 });
      if (!useMetadataPlaytime && !colPlaytime) return res.json({ characters: [], totalPlaytimeMinutes: 0 });

      const nameSel = useFirstLast
        ? `CONCAT(\`${colFirst}\`, ' ', \`${colLast}\`) AS name`
        : `\`${colName}\` AS name`;
      const moneySel = useAccountsJson ? `\`${colAccounts}\` AS accounts_json` : `\`${colMoney}\` AS money`;
      const playtimeSel = useMetadataPlaytime ? `\`${colMetadata}\` AS metadata_json` : `\`${colPlaytime}\` AS playtime_minutes`;

      const [rows] = await mysqlPool.query(
        `SELECT ${nameSel}, \`${colJob}\` AS job, ${moneySel}, ${playtimeSel} FROM \`${table}\` WHERE \`${colDiscord}\` = ?`,
        [String(discordId)]
      );

      const rowCount = (rows && rows.length) || 0;
      if (rowCount === 0) {
        console.log('MySQL karaktärer: 0 rader för discordId=', discordId);
      } else {
        console.log('MySQL karaktärer:', rowCount, 'karaktärer för discordId=', discordId);
      }

      const playtimeKey = DB_PLAYTIME_JSON_KEY;

      const characters = (rows || []).map((r) => {
        let money = 0;
        if (useAccountsJson && r.accounts_json) {
          try {
            const acc = typeof r.accounts_json === 'string' ? JSON.parse(r.accounts_json) : r.accounts_json;
            if (acc && Array.isArray(acc)) {
              acc.forEach((e) => {
                if (e && (e.name === 'bank' || e.name === 'money' || e.name === 'black_money')) money += Number(e.amount) || 0;
              });
            } else if (acc && typeof acc === 'object') {
              money = (Number(acc.bank) || 0) + (Number(acc.money) || 0) + (Number(acc.black_money) || 0);
            }
          } catch (_) {}
        } else {
          money = r.money != null ? Number(r.money) : 0;
        }
        let playtimeMinutes = 0;
        if (useMetadataPlaytime && r.metadata_json) {
          try {
            const meta = typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : r.metadata_json;
            let v = meta && meta[playtimeKey];
            v = v != null ? Math.max(0, Math.floor(Number(v))) : 0;
            playtimeMinutes = DB_PLAYTIME_UNIT === 'seconds' ? Math.floor(v / 60) : v;
          } catch (_) {}
        } else {
          let v = r.playtime_minutes != null ? Math.max(0, Math.floor(Number(r.playtime_minutes))) : 0;
          playtimeMinutes = DB_PLAYTIME_UNIT === 'seconds' ? Math.floor(v / 60) : v;
        }
        return {
          name: r.name != null ? String(r.name).trim() : '—',
          job: r.job != null ? String(r.job) : '—',
          money,
          playtimeMinutes,
        };
      });
      const totalPlaytimeMinutes = characters.reduce((sum, c) => sum + (c.playtimeMinutes || 0), 0);
      return res.json({ characters, totalPlaytimeMinutes });
    } catch (e) {
      console.error('MySQL karaktärer fel:', e.message);
      return res.json({ characters: [], totalPlaytimeMinutes: 0 });
    }
  }
  const store = loadPlayerStatsStore();
  const stats = store[discordId] || { characterCount: 0, totalPlaytimeMinutes: 0, characters: [] };
  const characters = Array.isArray(stats.characters) ? stats.characters : [];
  const totalPlaytimeMinutes = stats.totalPlaytimeMinutes != null ? stats.totalPlaytimeMinutes : 0;
  res.json({
    characters: characters.length ? characters : [],
    totalPlaytimeMinutes,
  });
});

// Uppdatera spelarstatistik (anropas t.ex. från FiveM-servern eller manuellt)
// Header: X-API-Key måste matcha PLAYER_STATS_API_KEY i .env (om den är satt)
// Body: discordId + valfritt characterCount, totalPlaytimeMinutes eller characters: [ { name, job, money, playtimeMinutes }, ... ]
app.post('/api/player-stats/update', (req, res) => {
  const apiKey = process.env.PLAYER_STATS_API_KEY;
  if (apiKey && req.get('X-API-Key') !== apiKey) {
    return res.status(401).json({ error: 'Invalid or missing X-API-Key' });
  }
  const { discordId, characterCount, totalPlaytimeMinutes, characters } = req.body || {};
  if (!discordId) {
    return res.status(400).json({ error: 'discordId required' });
  }
  const store = loadPlayerStatsStore();
  if (!store[discordId]) store[discordId] = { characterCount: 0, totalPlaytimeMinutes: 0, characters: [] };
  if (characterCount != null) store[discordId].characterCount = Number(characterCount) || 0;
  if (totalPlaytimeMinutes != null) store[discordId].totalPlaytimeMinutes = Math.max(0, Math.floor(Number(totalPlaytimeMinutes) || 0));
  if (Array.isArray(characters)) {
    store[discordId].characters = characters.map((c) => ({
      name: c.name != null ? String(c.name) : '—',
      job: c.job != null ? String(c.job) : '—',
      money: c.money != null ? Number(c.money) : 0,
      playtimeMinutes: c.playtimeMinutes != null ? Math.max(0, Math.floor(Number(c.playtimeMinutes))) : 0,
    }));
    store[discordId].characterCount = store[discordId].characters.length;
    store[discordId].totalPlaytimeMinutes = store[discordId].characters.reduce((s, c) => s + (c.playtimeMinutes || 0), 0);
  }
  savePlayerStatsStore(store);
  res.json({ ok: true });
});

// Config for frontend (connect link, Discord invite, dashboard links)
app.get('/api/config', (req, res) => {
  res.json({
    connectLink: `fivem://connect/${FIVEM_IP}:${FIVEM_PORT}`,
    discordInvite: process.env.DISCORD_INVITE_URL || '',
    links: {
      rules: process.env.RULES_URL || process.env.DISCORD_INVITE_URL || '#',
      whitelist: process.env.WHITELIST_URL || process.env.DISCORD_INVITE_URL || '#',
      reports: process.env.REPORTS_URL || process.env.DISCORD_INVITE_URL || '#',
      support: process.env.SUPPORT_URL || process.env.DISCORD_INVITE_URL || '#',
    },
  });
});

// ——— Kö till servern (in-memory; FIFO) ———
const queue = [];
const offeredSlots = {};
const OFFER_EXPIRE_MS = 30 * 1000;
const connectLink = () => `fivem://connect/${FIVEM_IP}:${FIVEM_PORT}`;

async function getServerSlotInfo() {
  try {
    const r = await fetch(`http://${FIVEM_IP}:${FIVEM_PORT}/dynamic.json`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return { online: false, players: 0, maxPlayers: 32 };
    const data = await r.json();
    const players = Number(data.clients ?? data.players ?? data.numClients ?? 0) || 0;
    const maxPlayers = Number(data.sv_maxclients ?? data.maxPlayers ?? 32) || 32;
    return { online: true, players, maxPlayers };
  } catch (e) {
    return { online: false, players: 0, maxPlayers: 32 };
  }
}

function expireOldOffers() {
  const now = Date.now();
  Object.keys(offeredSlots).forEach((discordId) => {
    if (now - offeredSlots[discordId].offeredAt > OFFER_EXPIRE_MS) {
      const entry = offeredSlots[discordId];
      delete offeredSlots[discordId];
      queue.push({ discordId, username: entry.username, joinedAt: entry.joinedAt });
    }
  });
}

app.post('/api/queue/join', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { id: discordId, username } = req.session.user;
  expireOldOffers();
  if (offeredSlots[discordId]) return res.json({ inQueue: false, offeredSlot: true, connectLink: offeredSlots[discordId].connectLink });
  const idx = queue.findIndex((e) => e.discordId === discordId);
  if (idx !== -1) return res.json({ inQueue: true, position: idx + 1 });
  queue.push({ discordId, username, joinedAt: Date.now() });
  res.json({ inQueue: true, position: queue.length });
});

app.get('/api/queue/status', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const discordId = req.session.user.id;
  expireOldOffers();
  if (offeredSlots[discordId]) {
    return res.json({ offeredSlot: true, connectLink: offeredSlots[discordId].connectLink });
  }
  const slot = await getServerSlotInfo();
  if (slot.online && slot.players < slot.maxPlayers && queue.length > 0) {
    const next = queue.shift();
    offeredSlots[next.discordId] = {
      connectLink: connectLink(),
      offeredAt: Date.now(),
      username: next.username,
      joinedAt: next.joinedAt,
    };
    if (next.discordId === discordId) {
      return res.json({ offeredSlot: true, connectLink: connectLink() });
    }
  }
  const pos = queue.findIndex((e) => e.discordId === discordId);
  if (pos !== -1) return res.json({ inQueue: true, position: pos + 1 });
  res.json({ inQueue: false });
});

app.post('/api/queue/leave', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const discordId = req.session.user.id;
  const qIdx = queue.findIndex((e) => e.discordId === discordId);
  if (qIdx !== -1) queue.splice(qIdx, 1);
  delete offeredSlots[discordId];
  res.json({ ok: true });
});

// ——— Start (hoppa över på Vercel – då anropas appen via api/index.js) ———
const isVercel = !!process.env.VERCEL;
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Fågelviken Portal running at http://localhost:${PORT}`);
    if (!DISCORD_CLIENT_ID) console.warn('Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET for login.');
  });
}
module.exports = app;
