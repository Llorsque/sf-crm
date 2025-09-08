import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="filter-bar">
      <input id="q" class="filter-input" placeholder="🔍 Zoek op naam…">
      <div id="dd-gemeente" class="dd"></div>
      <div id="dd-plaats" class="dd"></div>
      <div id="dd-sport" class="dd"></div>
      <div id="dd-profit" class="dd"></div>
      <div class="controls">
        <button id="clear" class="btn-accent" title="Wis filters">🧹 Wis</button>
        <button id="export" class="btn-accent">⬇️ Export</button>
        <button id="reload" class="btn-accent">🔄 Vernieuw</button>
      </div>
    </div>
    <div class="helper">Klik op een filter om opties te kiezen. Gebruik het zoekveld binnen de dropdown om snel te filteren.</div>
    <div class="counter" id="counter"></div>
    <div id="list" class="grid"></div>
    <div id="pager" class="pagination"></div>
    <div id="overlay" class="overlay"></div>
    <aside id="drawer" class="offscreen" aria-hidden="true">
      <div class="head">
        <h3 id="drawer-title">Details</h3>
        <button id="drawer-close" class="icon-btn" aria-label="Sluiten">✖</button>
      </div>
      <div class="body"><div id="kv" class="kv"></div><hr style="margin:12px 0;border:0;border-top:1px solid #eef0f6;"><div id="rel-trajecten"></div></div>
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
    const np = ['non','vereniging','stichting','ngo','vzw','sportbond','vereniging ']; // vereniging with space catches many
    const pf = ['profit','bv','b.v','vof','v.o.f','eenmanszaak','zzp','maatschap','cv','n.v','nv','holding','onderneming','bedrijf'];
    if (np.some(k => val.includes(k))) return 'Non-profit';
    if (pf.some(k => val.includes(k))) return 'Profit';
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
    all.forEach(r => { r.__plaats = extractPlaats(r['Postadres']); r.__profit = profitLabel(r); });
    return { rows: all, total: total ?? all.length };
  }

  // --- Checkbox dropdown component ---
  function CheckboxDropdown(rootEl, { label, format=(v)=>v }){
    const state = { options: [], filtered: [], selected: new Set() };
    rootEl.classList.add('dd');
    rootEl.innerHTML = `
      <button class="dd-btn">${label} <span class="count"></span></button>
      <div class="dd-menu">
        <div class="dd-tools">
          <button data-act="all">Alles</button>
          <button data-act="none">Geen</button>
        </div>
        <div class="dd-search"><input type="text" placeholder="Zoek in ${label.toLowerCase()}…"></div>
        <div class="dd-list"></div>
      </div>
    `;
    const btn = rootEl.querySelector('.dd-btn');
    const menu = rootEl.querySelector('.dd-menu');
    const list = rootEl.querySelector('.dd-list');
    const search = rootEl.querySelector('.dd-search input');
    const count = rootEl.querySelector('.count');
    let onChange = ()=>{};

    function open(){ rootEl.classList.add('open'); }
    function close(){ rootEl.classList.remove('open'); }
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const isOpen = rootEl.classList.contains('open');
      document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open'));
      if (!isOpen) open();
    });
    document.addEventListener('click', ()=> close());

    rootEl.querySelector('.dd-tools').addEventListener('click', (e)=>{
      const act = e.target.dataset.act;
      if (act==='all'){ state.options.forEach(v => state.selected.add(v)); renderList(); changed(); }
      if (act==='none'){ state.selected.clear(); renderList(); changed(); }
    });

    search.addEventListener('input', ()=>{
      const q = search.value.trim().toLowerCase();
      state.filtered = !q ? state.options : state.options.filter(v => format(v).toLowerCase().includes(q));
      renderList();
    });

    function renderList(){
      list.innerHTML = state.filtered.map(v => `
        <label class="dd-item"><input type="checkbox" value="${v}" ${state.selected.has(v)?'checked':''}/> ${format(v)}</label>
      `).join('');
      list.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', () => {
          if (chk.checked) state.selected.add(chk.value); else state.selected.delete(chk.value);
          changed();
        });
      });
      count.textContent = state.selected.size ? `(${state.selected.size})` : '';
    }

    function changed(){ onChange(getSelected()); }
    function setOptions(arr){
      state.options = [...arr];
      state.filtered = [...arr];
      renderList();
    }
    function getSelected(){ return [...state.selected]; }
    function clear(){ state.selected.clear(); search.value=''; state.filtered = state.options; renderList(); }
    function selectAll(){ state.options.forEach(v => state.selected.add(v)); renderList(); }
    function setOnChange(fn){ onChange = fn; }

    return { setOptions, getSelected, clear, selectAll, setOnChange };
  }

  // Build dropdowns
  const ddGemeente = CheckboxDropdown(document.getElementById('dd-gemeente'), { label:'Gemeente' });
  const ddPlaats   = CheckboxDropdown(document.getElementById('dd-plaats'),   { label:'Plaats' });
  const ddSport    = CheckboxDropdown(document.getElementById('dd-sport'),    { label:'Sport', format: titleCase });
  const ddProfit   = CheckboxDropdown(document.getElementById('dd-profit'),   { label:'Profit/Non-profit' });

  function hydrateFilters(){
    const gSet = new Set(), sSet = new Set(), pSet = new Set();
    state.rows.forEach(r => {
      if (r['Vestigingsgemeente']) gSet.add(r['Vestigingsgemeente']);
      if (r['Subsoort organisatie']) sSet.add(r['Subsoort organisatie']);
      if (r.__plaats) pSet.add(r.__plaats);
    });
    ddGemeente.setOptions([...gSet].sort());
    ddSport.setOptions([...sSet].sort());
    ddPlaats.setOptions([...pSet].sort());
    ddProfit.setOptions(['Non-profit', 'Profit']);
  }

  function updateCounter(){
    document.getElementById('counter').textContent = `Totaal ${state.total} clubs • Gefilterd ${state.filtered.length}`;
  }

  function applyFilters(){
    const q = document.getElementById('q').value.trim().toLowerCase();
    const gs = ddGemeente.getSelected();
    const ss = ddSport.getSelected();
    const ps = ddPlaats.getSelected();
    const pr = ddProfit.getSelected(); // 'Profit' / 'Non-profit'

    state.filtered = state.rows.filter(r => {
      const okQ = !q || (r['Naam']||'').toLowerCase().includes(q);
      const okG = gs.length===0 || gs.includes(r['Vestigingsgemeente']);
      const okS = ss.length===0 || ss.includes(r['Subsoort organisatie']);
      const okP = ps.length===0 || ps.includes(r.__plaats);
      const okR = pr.length===0 || pr.includes(r.__profit);
      return okQ && okG && okS && okP && okR;
    });
    state.page = 1;
    updateCounter();
    renderList();
  }

  function renderList(){
    const start = (state.page-1) * state.perPage;
    const pageRows = state.filtered.slice(start, start+state.perPage);

    document.getElementById('list').innerHTML = pageRows.map(r => `
      <article class="card" data-id="${r['Nr.']}">
        <h3>${r['Naam'] || 'Onbekend'}</h3>
        <div class="meta">🏅 ${titleCase(r['Subsoort organisatie'] || '-')}</div>
        <div class="meta">🏙️ ${r['Vestigingsgemeente'] || '-'}</div>
        <div class="meta">📍 ${r.__plaats || '-'}</div>
        <div class="meta">💼 ${r.__profit || '-'}</div>
        <button class="btn-accent btn-more" data-id="${r['Nr.']}">Details</button>
      </article>
    `).join('');

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.perPage));
    document.getElementById('pager').innerHTML = `
      <button id="prev" ${state.page===1?'disabled':''}>Vorige</button>
      <span>Pagina ${state.page} van ${totalPages}</span>
      <button id="next" ${state.page===totalPages?'disabled':''}>Volgende</button>
    `;
    document.getElementById('prev')?.addEventListener('click', ()=>{ state.page--; renderList(); });
    document.getElementById('next')?.addEventListener('click', ()=>{ state.page++; renderList(); });

    app.querySelectorAll('.btn-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const row = state.rows.find(r => String(r['Nr.'])===String(id));
        openDrawer(row);
      });
    });
  }

  async function openDrawer(row){
    if (!row) return;
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('overlay');
    document.getElementById('drawer-title').textContent = row['Naam'] || 'Details';
    const entries = Object.entries(row);
    document.getElementById('kv').innerHTML = entries.map(([k,v]) => `<div><strong>${k}</strong></div><div>${v ?? ''}</div>`).join('');
    // Fetch trajecten for this club
    try {
      const clubNr = row['Nr.'];
      const { data: tj, error: tjErr } = await supabase
        .from('trajecten')
        .select('id,titel,type,status,laatste_update,begroot_eur,financiering_eur,eigen_eur')
        .eq('club_nr', String(clubNr))
        .order('created_at', { ascending:false })
        .limit(20);
      const wrap = document.getElementById('rel-trajecten');
      if (tjErr) { console.error(tjErr); wrap.innerHTML = `<div class="mute...">Kon trajecten niet laden</div>`; }
      else if (!tj || !tj.length) { wrap.innerHTML = `<div class="mute...">Geen trajecten voor deze club</div>`; }
      else {
        wrap.innerHTML = `<h4 style="margin:6px 0 8px">Trajecten</h4>` + tj.map(r=>
          `<div class="chip-row">`
          + `<span class="chip">${r.type||'-'}</span>`
          + `<span class="chip">${r.status||'-'}</span>`
          + `<span class="chip">${(r.laatste_update||'').toString().slice(0,10)}</span>`
          + `<span class="chip">€ ${Number(r.begroot_eur||0).toLocaleString('nl-NL',{minimumFractionDigits:2})}</span>`
          + `</div>`
        ).join('');
      }
    } catch (e) { console.error(e); }

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
  ddGemeente.setOnChange(applyFilters);
  ddSport.setOnChange(applyFilters);
  ddPlaats.setOnChange(applyFilters);
  ddProfit.setOnChange(applyFilters);

  document.getElementById('reload').addEventListener('click', init);
  document.getElementById('export').addEventListener('click', exportCsv);
  document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('q').value = '';
    ddGemeente.clear(); ddSport.clear(); ddPlaats.clear(); ddProfit.clear();
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
