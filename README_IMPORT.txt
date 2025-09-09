CSV Importer – installatie
==========================
1) Kopieer `pages/import.js` naar je repo.
2) Voeg een link toe in je zijbalk/menu:
   <a data-page="import">📥 Import</a>
3) Zorg dat in Supabase de doeltabel `INSERT` en `UPDATE` toestaat voor jouw rol (anon/authenticated).
4) Open de pagina, kies tabel + match kolom (bijv. `id` of `club_nr`), upload CSV, map kolommen en run (of doe eerst een dry-run).
