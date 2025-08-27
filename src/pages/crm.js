let clubs = [];
let filteredClubs = [];
let currentPage = 1;
const pageSize = 50;

function renderFilters(app) {
  const uniqueGemeentes = [...new Set(clubs.map(c => c['Vestigingsgemeente']).filter(Boolean))].sort();
  const uniqueSports = [...new Set(clubs.map(c => c['Subsoort organisatie']).filter(Boolean))].sort();
  return `
    <div class="filters card">
      <input type="text" id="searchInput" placeholder="Zoek op naam..." />
      <select id="gemeenteFilter">
        <option value="">Alle gemeentes</option>
        ${uniqueGemeentes.map(g => `<option value="${g}">${g}</option>`).join('')}
      </select>
      <select id="sportFilter">
        <option value="">Alle sporten</option>
        ${uniqueSports.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <button id="exportBtn" class="add-btn">Exporteer selectie</button>
    </div>
  `;
}

function renderClubs(app) {
  const start = (currentPage-1)*pageSize;
  const pageClubs = filteredClubs.slice(start, start+pageSize);
  let html = pageClubs.map(club => `
    <div class="card club-card" data-id="${club.id}">
      <h3>${club.Naam}</h3>
      <p><strong>Sport:</strong> ${club['Subsoort organisatie'] || '-'}<br/>
      <strong>Gemeente:</strong> ${club['Vestigingsgemeente'] || '-'}<br/>
      <strong>Leden:</strong> ${club['Aantal leden'] || '-'}</p>
      <div class="details" style="display:none;">
        <p><strong>Adres:</strong> ${club.Postadres || ''}</p>
        <p><strong>Tel:</strong> ${club['Telefoonnr.'] || ''}</p>
        <p><strong>Email:</strong> ${club['E-mail'] || ''}</p>
        <p><strong>Contributie:</strong> ${club['Contributie'] || ''}</p>
      </div>
    </div>
  `).join('');
  if (!html) html = "<p>Geen resultaten gevonden.</p>";
  html += renderPagination();
  document.getElementById('results').innerHTML = html;
  document.querySelectorAll('.club-card').forEach(card => {
    card.addEventListener('click', () => {
      const details = card.querySelector('.details');
      details.style.display = details.style.display==='none' ? 'block':'none';
    });
  });
}

function renderPagination() {
  const totalPages = Math.ceil(filteredClubs.length/pageSize);
  return `
    <div class="pagination">
      <button id="prevPage" ${currentPage===1?'disabled':''}>Vorige</button>
      <span>Pagina ${currentPage} van ${totalPages}</span>
      <button id="nextPage" ${currentPage===totalPages?'disabled':''}>Volgende</button>
    </div>
  `;
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const gemeente = document.getElementById('gemeenteFilter').value;
  const sport = document.getElementById('sportFilter').value;
  filteredClubs = clubs.filter(c => {
    return (!search || c.Naam.toLowerCase().includes(search)) &&
           (!gemeente || c['Vestigingsgemeente']===gemeente) &&
           (!sport || c['Subsoort organisatie']===sport);
  });
  currentPage=1;
  renderClubs();
}

function exportSelection() {
  const csvRows = [];
  const headers = Object.keys(filteredClubs[0]||{});
  csvRows.push(headers.join(","));
  for (const row of filteredClubs) {
    csvRows.push(headers.map(h => `"${(row[h]||"").toString().replace(/"/g,'""')}"`).join(","));
  }
  const csvData = csvRows.join("\n");
  const blob = new Blob([csvData], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden','');
  a.href = url;
  a.download = 'clubs_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default async function(app) {
  app.innerHTML = "<h2>CRM Overzicht</h2><p>Data laden...</p><div id='filters'></div><div id='results'></div>";
  try {
    let res = await fetch('http://localhost:3000/clubs');
    if (!res.ok) throw new Error('Local server not reachable');
    clubs = await res.json();
  } catch (e) {
    const resLocal = await fetch('./db.json');
    clubs = (await resLocal.json()).clubs || [];
  }
  filteredClubs = clubs;
  document.getElementById('filters').innerHTML = renderFilters();
  renderClubs(app);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('gemeenteFilter').addEventListener('change', applyFilters);
  document.getElementById('sportFilter').addEventListener('change', applyFilters);
  document.getElementById('exportBtn').addEventListener('click', exportSelection);
  document.addEventListener('click', (e) => {
    if (e.target.id==='prevPage' && currentPage>1) {currentPage--; renderClubs();}
    if (e.target.id==='nextPage' && currentPage<Math.ceil(filteredClubs.length/pageSize)) {currentPage++; renderClubs();}
  });
}