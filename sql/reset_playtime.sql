-- Nollställ speltid (lastPlaytime) för karaktärer.
-- Kör i HeidiSQL mot er databas (t.ex. esxlegacy_9572da).
-- Portalen visar sedan 0 min tills ert playtime-script börjar lägga på tid igen.

-- Nollställ ALLA karaktärer i users:
UPDATE users SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.lastPlaytime', 0);

-- Vill du bara nollställa DINA karaktärer (sätt ditt Discord-ID):
-- UPDATE users SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.lastPlaytime', 0) WHERE discord_id = 'DITT_DISCORD_ID';
