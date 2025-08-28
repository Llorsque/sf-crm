import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="filter-bar">
      <input id="q" class="filter-input" placeholder="🔍 Zoek op naam…">
      <select id="gemeente" class="filter-select" multiple title="Selecteer meerdere met Ctrl/⌘"></select>
      <select id="plaats" class="filter-select" multiple title="Selecteer meerdere met Ctrl/⌘"></select>
      <select id="sport" class="filter-select" multiple title="Selecteer meerdere met Ctrl/⌘"></select>
      <div class="controls">
        <button id="clear" class="btn-accent" title="Wis filters">🧹 Wis</button>
        <button id="export" class="btn-accent">⬇️ Export</button>
        <button id="reload" class="btn-accent">🔄 Vernieuw</button>
      </div>
    </div>
    <div class="helper">Tip: houd <strong>Ctrl</strong> (Windows) of <strong>⌘</strong> (Mac) ingedrukt om meerdere opties te selecteren.</div>
    <div class="counter" id="counter"></div>
    <div id="list" class="grid"></div>
    <div id="pager" class="pagination"></div>
    <div id="overlay" class="overlay"></div>
    <aside id="drawer" class="offscreen" aria-hidden="true">
      <div class="head">
        <h3 id="drawer-title">Details</h3>
        <button id="drawer-close" class="icon-btn" aria-label="Sluiten">✖</button>
      </div>
      <div class="body"><div id="kv" class="kv"></div></div>
    </aside>
  `;

  const state = {
    rows: [], filtered: [], page: 1, perPage: 24, total: 0,
  };

  const $ = (sel)=> app.querySelector(sel);

  // --- Helpers ---
  function titleCase(s=''){
    return s.toString().toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase());
  }
  function profitLabel(row){
    const val = (row['Soort Organisatie'] || '').toString().toLowerCase();
    if (!val) return '-';
    if (val.includes('non') || val.includes('vereniging') || val.includes('stichting') || val.includes('ngo')) return 'Non-profit';
    if (val.includes('profit') || val.includes('bv') || val.includes('b.v') || val.includes('vof')) return 'Profit';
    return titleCase(val);
  }
  function extractPlaats(postadres=''){
    if (!postadres) return '';
    const m = postadres.match(/\b\d{4}\s?[A-Z]{2}\s+(.+)/i);
    if (m) return m[1].trim();
    const parts = postadres.split(/[;\n,]/).map(s=>s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }
  const COLUMNS = '"Nr.", "Naam", "Soort Organisatie", "Subsoort organisatie", "Vestigingsgemeente", "Telefoonnr.", "E-mail", "Postadres", "Aantal leden"';

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
    }
    all.forEach(r => { r.__plaats = extractPlaats(r['Postadres']); });
    return { rows: all, total: total ?? all.length };
  }

  function setOptions(sel, arr, format=(v)=>v){
    sel.innerHTML = arr.map(v=>`<option value="${v}">${format(v)}</option>`).join('');
  }

  function hydrateFilters(){
    const gSet = new Set(), sSet = new Set(), pSet = new Set();
    state.rows.forEach(r => {
      if (r['Vestigingsgemeente']) gSet.add(r['Vestigingsgemeente']);
      if (r['Subsoort organisatie']) sSet.add(r['Subsoort organisatie']);
      if (r.__plaats) pSet.add(r.__plaats);
    });
    setOptions($('#gemeente'), [...gSet].sort());
    setOptions($('#sport'), [...sSet].sort(), titleCase);
    setOptions($('#plaats'), [...pSet].sort());
  }

  function vals(sel){
    return Array.from(sel.selectedOptions).map(o=>o.value);
  }

  function updateCounter(){
    $('#counter').textContent = `Totaal ${state.total} clubs • Gefilterd ${state.filtered.length}`;
  }

  function applyFilters(){
    const q = $('#q').value.trim().toLowerCase();
    const gs = vals($('#gemeente'));
    const ss = vals($('#sport'));
    const ps = vals($('#plaats'));
    state.filtered = state.rows.filter(r => {
      const okQ = !q || (r['Naam']||'').toLowerCase().includes(q);
      const okG = gs.length===0 || gs.includes(r['Vestigingsgemeente']);
      const okS = ss.length===0 || ss.includes(r['Subsoort organisatie']);
      const okP = ps.length===0 || ps.includes(r.__plaats);
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
        <div class="meta">🏅 ${titleCase(r['Subsoort organisatie'] || '-')}</div>
        <div class="meta">🏙️ ${r['Vestigingsgemeente'] || '-'}</div>
        <div class="meta">💼 ${profitLabel(r)}</div>
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
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('overlay');
    document.getElementById('drawer-title').textContent = row['Naam'] || 'Details';
    const entries = Object.entries(row);
    document.getElementById('kv').innerHTML = entries.map(([k,v]) => `<div><strong>${k}</strong></div><div>${v ?? ''}</div>`).join('');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
  }
  function closeDrawer(){
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('overlay');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('show');
  }

  // events
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeDrawer(); });

  document.getElementById('q').addEventListener('input', applyFilters);
  document.getElementById('gemeente').addEventListener('change', applyFilters);
  document.getElementById('sport').addEventListener('change', applyFilters);
  document.getElementById('plaats').addEventListener('change', applyFilters);
  document.getElementById('reload').addEventListener('click', init);
  document.getElementById('export').addEventListener('click', exportCsv);
  document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('q').value = '';
    ['gemeente','sport','plaats'].forEach(id => {
      const sel = document.getElementById(id);
      Array.from(sel.options).forEach(o => o.selected = false);
    });
    applyFilters();
  });

  // initial
  await init();

  async function init(){
    document.getElementById('list').innerHTML = '<p class="muted">Data laden…</p>';
    try{
      const { rows, total } = await fetchAll();
      state.rows = rows;
      state.total = total ?? rows.length;
      hydrateFilters();
      applyFilters();
    }catch(e){
      console.error(e);
      document.getElementById('list').innerHTML = '<div class="alert">Fout bij laden van data.</div>';
    }
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
}
