export default async function(app) {
  const res = await fetch('../db.json');
  const data = await res.json();
  const clubs = data.clubs || [];
  let html = `<h2>CRM Overzicht</h2>`;
  html += `<div class='card'><p>Totaal verenigingen: ${clubs.length}</p></div>`;
  clubs.forEach(club => {
    html += `<div class='card'>
      <h3>${club.naam}</h3>
      <p><strong>Sport:</strong> ${club.subsoort || '-'}<br/>
      <strong>Gemeente:</strong> ${club.gemeente || '-'}<br/>
      <strong>Leden:</strong> ${club.leden || '-'}</p>
    </div>`;
  });
  app.innerHTML = html;
}