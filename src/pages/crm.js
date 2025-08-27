export default async function(app) {
  let clubs = [];
  try {
    // Probeer JSON Server
    const res = await fetch('http://localhost:3000/clubs');
    if (res.ok) {
      clubs = await res.json();
    } else {
      throw new Error('Server niet bereikbaar');
    }
  } catch (e) {
    // Fallback naar lokale db.json
    try {
      const resLocal = await fetch('./db.json');
      clubs = await resLocal.json();
    } catch (err) {
      app.innerHTML = `<p>Kan clubs niet laden.</p>`;
      return;
    }
  }

  let html = `<h2>CRM Overzicht</h2>`;
  html += `<button class='add-btn'>+ Voeg club toe</button>`;
  clubs.forEach(club => {
    html += `<div class='card'>
      <h3>${club.naam}</h3>
      <p><strong>Sport:</strong> ${club.subsoort || '-'}<br/>
      <strong>Gemeente:</strong> ${club.gemeente || '-'}<br/>
      <strong>Leden:</strong> ${club.leden || '-'}</p>
      <div class="action-buttons">
        <button class="edit-btn">Bewerken</button>
        <button class="delete-btn">Verwijderen</button>
      </div>
    </div>`;
  });
  app.innerHTML = html;
}