Gebruik:
1) Upload beide bestanden uit deze zip naar je repo:
   - /app.js   (vervang bestaande)
   - /pages/trajecten.js  (vervang bestaande)
2) Controleer in index.html dat de onderste regel is:
   <script type="module" src="app.js?v=21"></script>
3) Browser: DevTools -> Network -> Disable cache -> herlaad.
4) In Console zie je nu [loader]-logs en bij fouten óók een 'runtime error' melding.
