import { supabase } from '../supabaseClient.js'

let clubs = []
let filteredClubs = []
let currentPage = 1
const pageSize = 20

function renderFilters() {
  return `
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="🔍 Zoek op naam..." class="filter-input"/>
      <select id="gemeenteFilter" class="filter-select"></select>
      <select id="sportFilter" class="filter-select"></select>
      <button id="refreshBtn" class="btn-accent">🔄 Refresh</button>
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
        <h3>${club['Naam'] || 'Onbekend'}</h3>
        <span class="tag">${club['Subsoort organisatie'] || '-'}</span>
      </div>
      <p class="meta">🏙️ ${club['Vestigingsgemeente'] || '-'}</p>
      <p class="meta">👥 ${club['Aantal leden'] || '-'}</p>
      <button class="btn-details" onclick='showDetails(${JSON.stringify(club)})'>Details</button>
    </div>
  `).join('')
  html += '</div>'
  if (!pageClubs.length) html = "<p>Geen resultaten gevonden.</p>"
  html += renderPagination()
  document.getElementById('results').innerHTML = html
}

window.showDetails = (club) => {
  const panel = document.createElement('div')
  panel.className = 'detail-panel'
  panel.innerHTML = `
    <div class="panel-content">
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">✖</button>
      <h3>${club['Naam']}</h3>
      <div class="detail-grid">
        ${Object.entries(club).map(([k,v]) => `<p><strong>${k}</strong>: ${v||''}</p>`).join('')}
      </div>
    </div>`
  document.body.appendChild(panel)
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

async function loadData() {
  document.getElementById('results').innerHTML = "<p>Data laden...</p>"
  const { data, error } = await supabase.from('clubs').select('"Nr.", "Naam", "Subsoort organisatie", "Vestigingsgemeente", "Aantal leden", "E-mail", "Telefoonnr."').limit(500)
  if (error) {
    document.getElementById('results').innerHTML = `<p>Fout bij laden: ${error.message}</p>`
    return
  }
  console.log("Supabase data:", data)
  clubs = data
  filteredClubs = clubs

  const gemeentes = [...new Set(clubs.map(c => c['Vestigingsgemeente']).filter(Boolean))].sort()
  const sporten = [...new Set(clubs.map(c => c['Subsoort organisatie']).filter(Boolean))].sort()
  document.getElementById('gemeenteFilter').innerHTML = '<option value="">🌍 Alle gemeentes</option>' + gemeentes.map(g=>`<option value="${g}">${g}</option>`).join('')
  document.getElementById('sportFilter').innerHTML = '<option value="">🏅 Alle sporten</option>' + sporten.map(s=>`<option value="${s}">${s}</option>`).join('')

  renderClubs()
}

export default async function(app) {
  app.innerHTML = "<h2>CRM Overzicht</h2><div id='filters'></div><div id='results'></div>"
  document.getElementById('filters').innerHTML = renderFilters()
  await loadData()

  document.getElementById('searchInput').addEventListener('input', applyFilters)
  document.getElementById('gemeenteFilter').addEventListener('change', applyFilters)
  document.getElementById('sportFilter').addEventListener('change', applyFilters)
  document.getElementById('refreshBtn').addEventListener('click', loadData)

  document.addEventListener('click', (e) => {
    if (e.target.id==='prevPage' && currentPage>1) {currentPage--; renderClubs();}
    if (e.target.id==='nextPage' && currentPage<Math.ceil(filteredClubs.length/pageSize)) {currentPage++; renderClubs();}
  })
}
