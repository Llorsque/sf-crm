PATCH v20 – veilige herstelset (loader + trajecten module)
=========================================================

Wat zit erin?
- app.js – robuuste module-loader (zonder async/await), versie VER=20
- pages/trajecten.js – minimale, gegarandeerd-ladende module (je kunt later je volledige code hier terugzetten zodra het laden werkt)
- favicon.ico – placeholder om 404 te voorkomen

Zo zet je het goed neer (heel precies):
1) Upload de BESTANDEN uit deze zip naar *dezelfde paden* in je repo:
   - /app.js
   - /pages/trajecten.js
   - /favicon.ico

2) Open je /index.html en controleer **deze ene regel onderaan** vlak voor </body>:
   <script type="module" src="app.js?v=20"></script>

   Staat er een ándere regel met app.js? Verwijder die. Er mag er echt maar één zijn.

3) Open je site, zet in DevTools (Network) **Disable cache** aan, herlaad.
   Je Console moet nu laten zien:
   [loader] preflight ./pages/trajecten.js?chk=20 200
   [loader] try import ./pages/trajecten.js?v=20
   [loader] imported ok: trajecten { default: f }

Als dit werkt, kunnen we je volledige trajecten-functionaliteit weer terugzetten in pages/trajecten.js.
