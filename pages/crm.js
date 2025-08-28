import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="filter-bar">
      <input id="q" class="filter-input" placeholder="🔍 Zoek op naam…">
      <select id="gemeente" class="filter-select"><option value="">🌍 Alle gemeentes</option></select>
      <select id="plaats" class="filter-select"><option value="">🏠 Alle plaatsen</option></select>
      <select id="sport" class="filter-select"><option value="">🏅 Alle sporten</option></select>
      <div class="controls">
        <button id="export" class="btn-accent">⬇️ Export CSV</button>
        <button id="reload" class="btn-accent">🔄 Vernieuwen</button>
      </div>
    </div>
    <div class="counter" id="counter"></div>
    <div id="list" class="grid"></div>
    <div id="pager" class="pagination"></div>
    <aside id="drawer" class="offscreen">
      <div class="head">
        <h3 id="drawer-title">Details</h3>
        <button id="drawer-close" class="btn-accent">Sluit</button>
      </div>
      <div class="body"><div id="kv" class="kv"></div></div>
    </aside>
  `;

  const state = {
    rows: [], filtered: [], page: 1, perPage: 24, total: 0,
  };

  const $ = (sel)=> app.querySelector(sel);

  $('#drawer-close').onclick = () => $('#drawer').classList.remove('open');

  // --- Helpers ---
  function extractPlaats(postadres=''){
    if (!postadres) return '';
    // veel NL formats bevatten postcode (1234 AB Plaats)
    const m = postadres.match(/\b\d{4}\s?[A-Z]{2}\s+(.+)/i);
    if (m) return m[1].trim();
    // of laatste segment na komma/regel
    const parts = postadres.split(/[;\n,]/).map(s=>s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  const COLUMNS = '"Nr.", "Naam", "Soort Organisatie", "Subsoort organisatie", "Vestigingsgemeente", "Telefoonnr.", "E-mail", "Postadres", "Aantal leden"';

  // Supabase haalt max 1000 per request -> chunked fetch tot alles binnen is
  async function fetchAll(){
    const step = 1000;
    let from = 0;
    let all = [];
    let total = null;
    while (true){
      const { data, error, count } = await supabase
        .from('clubs')
        .select(COLUMNS, { count: 'exact' })
        .range(from, from + step - 1);
      if (error){ throw error; }
      if (total===null) total = count ?? (data ? data.length : 0);
      if (data && data.length){
        all = all.concat(data);
        from += step;
      }
      if (!data || data.length < step) break;
      // Loop door tot alles binnen is
    }
    // verrijk met afgeleide plaats
    all.forEach(r => { r.__plaats = extractPlaats(r['Postadres']); });
    return { rows: all, total: total ?? all.length };
  }

  function hydrateFilters(){
    const gSet = new Set(), sSet = new Set(), pSet = new Set();
    state.rows.forEach(r => {
      if (r['Vestigingsgemeente']) gSet.add(r['Vestigingsgemeente']);
      if (r['Subsoort organisatie']) sSet.add(r['Subsoort organisatie']);
      if (r.__plaats) pSet.add(r.__plaats);
    });
    $('#gemeente').innerHTML = '<option value="">🌍 Alle gemeentes</option>' + [...gSet].sort().map(v=>`<option>${v}</option>`).join('');
    $('#sport').innerHTML = '<option value="">🏅 Alle sporten</option>' + [...sSet].sort().map(v=>`<option>${v}</option>`).join('');
    $('#plaats').innerHTML = '<option value="">🏠 Alle plaatsen</option>' + [...pSet].sort().map(v=>`<option>${v}</option>`).join('');
  }

  function updateCounter(){
    $('#counter').textContent = `Totaal ${state.total} clubs • Gefilterd ${state.filtered.length}`;
  }

  function applyFilters(){
    const q = $('#q').value.trim().toLowerCase();
    const g = $('#gemeente').value;
    const s = $('#sport').value;
    const p = $('#plaats').value;
    state.filtered = state.rows.filter(r => {
      const okQ = !q || (r['Naam']||'').toLowerCase().includes(q);
      const okG = !g || r['Vestigingsgemeente']===g;
      const okS = !s || r['Subsoort organisatie']===s;
      const okP = !p || r.__plaats===p;
      return okQ && okG && okS && okP;
    });
    state.page = 1;
    updateCounter();
    renderList();
  }

  function renderList(){
    const start = (state.page-1) * state.perPage;
    const pageRows = state.filtered.slice(start, start+state.perPage);

    $('#list').innerHTML = pageRows.map(r => `
      <article class="card" data-id="${r['Nr.']}">
        <h3>${r['Naam'] || 'Onbekend'}</h3>
        <div class="meta">🏅 ${r['Subsoort organisatie'] || '-'}</div>
        <div class="meta">🏙️ ${r['Vestigingsgemeente'] || '-'}</div>
        <div class="meta">📍 ${r.__plaats || '-'}</div>
        <div class="meta">👥 ${r['Aantal leden'] || '-'}</div>
        <button class="btn-accent btn-more" data-id="${r['Nr.']}">Details</button>
      </article>
    `).join('');

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.perPage));
    $('#pager').innerHTML = `
      <button id="prev" ${state.page===1?'disabled':''}>Vorige</button>
      <span>Pagina ${state.page} van ${totalPages}</span>
      <button id="next" ${state.page===totalPages?'disabled':''}>Volgende</button>
    `;
    $('#prev')?.addEventListener('click', ()=>{ state.page--; renderList(); });
    $('#next')?.addEventListener('click', ()=>{ state.page++; renderList(); });

    app.querySelectorAll('.btn-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const row = state.rows.find(r => String(r['Nr.'])===String(id));
        openDrawer(row);
      });
    });
  }

  function openDrawer(row){
    if (!row) return;
    document.getElementById('drawer-title').textContent = row['Naam'] || 'Details';
    const entries = Object.entries(row);
    document.getElementById('kv').innerHTML = entries.map(([k,v]) => `<div><strong>${k}</strong></div><div>${v ?? ''}</div>`).join('');
    document.getElementById('drawer').classList.add('open');
  }

  function exportCsv(){
    const rows = state.filtered.length ? state.filtered : state.rows;
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (val) => '"' + String(val ?? '').replace(/"/g,'""') + '"';
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clubs_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // events
  $('#q').addEventListener('input', applyFilters);
  $('#gemeente').addEventListener('change', applyFilters);
  $('#sport').addEventListener('change', applyFilters);
  $('#plaats').addEventListener('change', applyFilters);
  $('#reload').addEventListener('click', init);
  $('#export').addEventListener('click', exportCsv);

  // initial
  await init();

  async function init(){
    $('#list').innerHTML = '<p class="muted">Data laden…</p>';
    try{
      const { rows, total } = await fetchAll();
      state.rows = rows;
      state.total = total ?? rows.length;
      hydrateFilters();
      applyFilters();
    }catch(e){
      console.error(e);
      $('#list').innerHTML = '<div class="alert">Fout bij laden van data.</div>';
    }
  }
}
