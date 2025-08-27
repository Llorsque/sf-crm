export default async function(app) {
  try {
    const res = await fetch('http://localhost:3000/clubs');
    const clubs = await res.json();
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
  } catch (e) {
    app.innerHTML = `<p>Kan clubs niet laden. Draait je JSON Server al?</p>`;
  }
}