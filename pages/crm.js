import { supabase } from '../supabaseClient.js'

let clubs = []
let filteredClubs = []
let currentPage = 1
const pageSize = 24

function renderFilters() {
  const uniqueGemeentes = [...new Set(clubs.map(c => c['Vestigingsgemeente']).filter(Boolean))].sort()
  const uniqueSports = [...new Set(clubs.map(c => c['Subsoort organisatie']).filter(Boolean))].sort()
  return `
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="🔍 Zoek op naam..." class="filter-input"/>
      <select id="gemeenteFilter" class="filter-select">
        <option value="">Alle gemeentes</option>
        ${uniqueGemeentes.map(g => `<option value="${g}">${g}</option>`).join('')}
      </select>
      <select id="sportFilter" class="filter-select">
        <option value="">Alle sporten</option>
        ${uniqueSports.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
  `
}

function renderClubs() {
  const start = (currentPage-1)*pageSize
  const pageClubs = filteredClubs.slice(start, start+pageSize)
  let html = '<div class="club-grid">'
  html += pageClubs.map(club => `
    <div class="club-card">
      <div class="club-header">
        <h3>${club['Naam']}</h3>
        <span class="tag">${club['Subsoort organisatie'] || '-'}</span>
      </div>
      <p class="meta">🏙️ ${club['Vestigingsgemeente'] || '-'}</p>
      <p class="meta">👥 ${club['Aantal leden'] || '-'}</p>
      <div class="details">
        <p>📍 ${club['Postadres'] || ''}</p>
        <p>📞 ${club['Telefoonnr.'] || ''}</p>
        <p>✉️ ${club['E-mail'] || ''}</p>
        <p>🏢 ${club['Soort Organisatie'] || ''}</p>
      </div>
    </div>
  `).join('')
  html += '</div>'
  if (!pageClubs.length) html = "<p>Geen resultaten gevonden.</p>"
  html += renderPagination()
  document.getElementById('results').innerHTML = html
}

function renderPagination() {
  const totalPages = Math.ceil(filteredClubs.length/pageSize)
  return `
    <div class="pagination">
      <button id="prevPage" ${currentPage===1?'disabled':''}>Vorige</button>
      <span>Pagina ${currentPage} van ${totalPages}</span>
      <button id="nextPage" ${currentPage===totalPages?'disabled':''}>Volgende</button>
    </div>
  `
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase()
  const gemeente = document.getElementById('gemeenteFilter').value
  const sport = document.getElementById('sportFilter').value
  filteredClubs = clubs.filter(c => {
    return (!search || (c['Naam'] && c['Naam'].toLowerCase().includes(search))) &&
           (!gemeente || c['Vestigingsgemeente']===gemeente) &&
           (!sport || c['Subsoort organisatie']===sport)
  })
  currentPage=1
  renderClubs()
}

export default async function(app) {
  app.innerHTML = "<h2>CRM Overzicht</h2><p>Data laden...</p><div id='filters'></div><div id='results'></div>"
  const { data, error } = await supabase
    .from('clubs')
    .select('Nr., Naam, Soort Organisatie, Subsoort organisatie, Vestigingsgemeente, Telefoonnr., E-mail, Postadres, Aantal leden')
    .limit(500)

  if (error) {
    app.innerHTML = `<p>Fout bij laden: ${error.message}</p>`
    return
  }

  clubs = data
  filteredClubs = clubs
  document.getElementById('filters').innerHTML = renderFilters()
  renderClubs()

  document.getElementById('searchInput').addEventListener('input', applyFilters)
  document.getElementById('gemeenteFilter').addEventListener('change', applyFilters)
  document.getElementById('sportFilter').addEventListener('change', applyFilters)

  document.addEventListener('click', (e) => {
    if (e.target.id==='prevPage' && currentPage>1) {currentPage--; renderClubs();}
    if (e.target.id==='nextPage' && currentPage<Math.ceil(filteredClubs.length/pageSize)) {currentPage++; renderClubs();}
  })
}
