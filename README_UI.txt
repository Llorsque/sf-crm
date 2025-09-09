UI upgrade voor Trajecten (v21-UI)
=================================

Bestanden in deze patch:
- pages/trajecten.js  -> vervangt de huidige module met een nette UI (kaarten, badges, modal)
- styles.css          -> voegt UI-styling toe (onderaan plakken of bestand vervangen)

Installatie:
1) Upload *beide* bestanden naar je repo op dezelfde paden (vervang bestaande).
2) Hard refresh in je browser (DevTools -> Network -> Disable cache -> Reload).

Let op: de code gebruikt bewust geen async/await en geen optional chaining zodat alle browsers het slikken.
