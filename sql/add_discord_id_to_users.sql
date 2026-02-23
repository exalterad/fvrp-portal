-- Lägg till kolumnen discord_id i tabellen users
-- så att portalen kan koppla inloggade Discord-användare till sina karaktärer.
-- Kör denna fil i HeidiSQL (eller annan MySQL-klient) mot er databas (t.ex. esxlegacy_9572da).

ALTER TABLE users ADD COLUMN discord_id VARCHAR(64) DEFAULT NULL;

-- Om kolumnen redan finns och du får fel, kommentera bort raden ovan och använd istället:
-- ALTER TABLE users MODIFY COLUMN discord_id VARCHAR(64) DEFAULT NULL;
