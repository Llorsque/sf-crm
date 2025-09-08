Supabase setup voor TRAJECTEN (prototype)

1) Open Supabase project → SQL Editor.
2) Plak de inhoud van `supabase-trajecten.sql` en voer uit.
   - Dit maakt de tabel `public.trajecten` aan en zet open RLS policies (SELECT/INSERT/UPDATE/DELETE).
3) Test in de app: nieuw traject opslaan.

Let op (later voor productie): beperk policies i.p.v. "allow all".