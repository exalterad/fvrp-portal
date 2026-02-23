-- Sätt discord_id på dina karaktärer så att portalen visar dem på dashboarden.
-- 1) Hämta ditt Discord-ID: Discord → Inställningar → Avancerat → Utvecklarläge (på). Högerklicka på dig → Kopiera användar-ID.
-- 2) Ersätt YOUR_DISCORD_ID nedan med det ID:t (bara siffror, t.ex. 123456789012345678).
-- 3) Om du bara vill koppla vissa karaktärer: använd WHERE id IN (3, 6) med de id:n som är Diego/Kalle etc.
-- 4) Kör filen i HeidiSQL (Query-flik, klistra in, F9).

-- Alla karaktärer kopplas till ditt Discord (bra för test med ett konto):
UPDATE users SET discord_id = '1069322765447987210';

-- Eller bara vissa karaktärer (ändra id siffrorna efter vad du ser i tabellen):
-- UPDATE users SET discord_id = 'YOUR_DISCORD_ID' WHERE id IN (3, 6);
