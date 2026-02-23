-- Visa BARA DINA egna karaktärer på dashboarden
-- Portalen visar endast rader där discord_id = ditt inloggade Discord-ID.
-- Alla andra karaktärer (som tillhör andra spelare) ska ha discord_id = NULL.
--
-- 1) Rensa discord_id på ALLA karaktärer först:
UPDATE users SET discord_id = NULL;

-- 2) Sätt ditt Discord-ID BARA på de karaktärer som verkligen är dina.
--    Ersätt DITT_DISCORD_ID med ditt användar-ID från Discord (Högerklicka på dig → Kopiera användar-ID).
--    Ändra id-numren (3, 6) till de som är DINA – titta i tabellen users, kolumn id.
--    T.ex. om Diego Haddad (id 3) och Kalle Karlsson (id 6) är dina:
UPDATE users SET discord_id = 'DITT_DISCORD_ID' WHERE id IN (3, 6);

-- Då har bara dessa två ditt Discord-ID. Jeffrey Epstein och Essi Jafar får NULL
-- och kommer inte visas för dig – de kan senare kopplas till andra spelares Discord-ID.
