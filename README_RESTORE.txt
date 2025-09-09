UI-restore patch
================
1) Upload **beide** bestanden naar je repo (zelfde padnames):
   - /styles.css  (herstelt het basis-thema dat de hele app gebruikt)
   - /pages/trajecten.js  (Trajecten-module met gescope’de CSS, beïnvloedt geen andere pagina’s)
2) Zet in je browser DevTools -> Network -> Disable cache aan, en herlaad.

Als je eigen styles.css afwijkingen heeft ten opzichte van dit basisthema, laat het weten; ik kan de patch exact naar jouw originele styles terugzetten.
