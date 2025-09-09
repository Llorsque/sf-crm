# Sidebar Patch (zonder HTML aanpassen)

Deze patch voegt automatisch **Trajecten** en **Data-import** toe aan je sidebar.

## Gebruik
1. Zet `sidebar-patch.js` in de **root** van je sf-crm (naast `index.html` en `app.js`).
2. Voeg **één regel** toe in je `index.html`, onder de bestaande script tags:
   ```html
   <script type="module" src="./sidebar-patch.js"></script>
   ```
3. Commit & deploy.

De links roepen `loadPage('<name>')` aan als die global bestaat (zoals in jouw SPA). Anders valt het terug op `location.hash` en een `navigate`-event.

## Styling
De links krijgen class `nav-link` en `active`. Dat sluit aan op de bestaande styling in je project.
