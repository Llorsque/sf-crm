import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="filter-bar filter-row">
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

    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin:12px 0;" id="kpis"></div>

    <div class="card" style="padding:0; overflow:hidden">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid #eef0f6">
        <strong>Kaart (gefilterde clubs)</strong>
        <small id="geo-status" class="muted">Geocoding: 0/0</small>
      </div>
      <div id="map" style="height:520px; width:100%"></div>
    </div>
  `;

  const state = {
    all: [], filtered: [], total: 0,
    geoCache: loadCache(), // { place: {lat,lng} }
    geoQueue: [], geoInFlight: 0, geoDone: 0, geoTotal: 0,
    map: null, markers: null, leafletReady: false,
  };

  const $ = (sel)=> app.querySelector(sel);

  // -------- Utilities --------
  function titleCase(s=''){ return s.toString().toLowerCase().replace(/\b([a-zà-ÿ])/g, m => m.toUpperCase()); }
  function profitLabel(row){
    const val = (row['Soort Organisatie'] || '').toString().toLowerCase();
    if (!val) return '-';
    const np = ['non','vereniging','stichting','ngo','vzw','sportbond','vereniging '];
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

  // -------- Supabase fetch (chunked) --------
  const COLUMNS = '"Nr.", "Naam", "Soort Organisatie", "Subsoort organisatie", "Vestigingsgemeente", "Telefoonnr.", "E-mail", "Postadres"';
  async function fetchAll(){
    const step = 1000;
    let from = 0, all = [], total = null;
    while (true){
      const { data, error, count } = await supabase
        .from('clubs')
        .select(COLUMNS, { count: 'exact' })
        .range(from, from + step - 1);
      if (error) throw error;
      if (total===null) total = count ?? (data ? data.length : 0);
      if (data && data.length){
        all = all.concat(data);
        from += step;
      }
      if (!data || data.length < step) break;
    }
    // derive fields
    all.forEach(r => { r.__plaats = extractPlaats(r['Postadres']); r.__profit = profitLabel(r); });
    return { rows: all, total: total ?? all.length };
  }

  // -------- CheckboxDropdown component (same as CRM) --------
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

  // -------- Build UI --------
  const ddGemeente = CheckboxDropdown(document.getElementById('dd-gemeente'), { label:'Gemeente' });
  const ddPlaats   = CheckboxDropdown(document.getElementById('dd-plaats'),   { label:'Plaats' });
  const ddSport    = CheckboxDropdown(document.getElementById('dd-sport'),    { label:'Sport', format:titleCase });
  const ddProfit   = CheckboxDropdown(document.getElementById('dd-profit'),   { label:'Profit/Non-profit' });

  function hydrateFilters(){
    const gSet = new Set(), sSet = new Set(), pSet = new Set();
    state.all.forEach(r => {
      if (r['Vestigingsgemeente']) gSet.add(r['Vestigingsgemeente']);
      if (r['Subsoort organisatie']) sSet.add(r['Subsoort organisatie']);
      if (r.__plaats) pSet.add(r.__plaats);
    });
    ddGemeente.setOptions([...gSet].sort());
    ddSport.setOptions([...sSet].sort());
    ddPlaats.setOptions([...pSet].sort());
    ddProfit.setOptions(['Non-profit','Profit']);
  }

  function applyFilters(){
    const q = $('#q').value.trim().toLowerCase();
    const gs = ddGemeente.getSelected();
    const ss = ddSport.getSelected();
    const ps = ddPlaats.getSelected();
    const pr = ddProfit.getSelected();

    state.filtered = state.all.filter(r => {
      const okQ = !q || (r['Naam']||'').toLowerCase().includes(q);
      const okG = gs.length===0 || gs.includes(r['Vestigingsgemeente']);
      const okS = ss.length===0 || ss.includes(r['Subsoort organisatie']);
      const okP = ps.length===0 || ps.includes(r.__plaats);
      const okR = pr.length===0 || pr.includes(r.__profit);
      return okQ && okG && okS && okP && okR;
    });
    renderKPIs();
    updateMap();
  }

  // -------- KPIs --------
  function renderKPIs(){
    const el = document.getElementById('kpis');
    const rows = state.filtered;
    const total = rows.length;
    const np = rows.filter(r => r.__profit==='Non-profit').length;
    const pf = rows.filter(r => r.__profit==='Profit').length;
    const pct = (x, y) => (y? Math.round((x/y)*100):0) + '%';
    const uniq = (arr, key) => [...new Set(arr.map(r => r[key]).filter(Boolean))];
    const sports = uniq(rows, 'Subsoort organisatie');
    const gemeenten = uniq(rows, 'Vestigingsgemeente');
    const plaatsen = [...new Set(rows.map(r=>r.__plaats).filter(Boolean))];
    const withEmail = rows.filter(r => !!r['E-mail']).length;
    const withPhone = rows.filter(r => !!r['Telefoonnr.']).length;
    const topSport = (()=>{
      const m = new Map();
      rows.forEach(r=>{ const k=r['Subsoort organisatie']; if(!k) return; m.set(k, (m.get(k)||0)+1) });
      let best = ['',0]; m.forEach((v,k)=>{ if(v>best[1]) best=[k,v]; });
      return best;
    })();

    const cards = [
      ['Totaal clubs', total],
      ['Non-profit', `${np} (${pct(np,total)})`],
      ['Profit', `${pf} (${pct(pf,total)})`],
      ['# Gemeenten', gemeenten.length],
      ['# Plaatsen', plaatsen.length],
      ['# Sporten', sports.length],
      ['Top sport', topSport[0] ? titleCase(topSport[0]) : '—'],
      ['Top sport (#)', topSport[1] || 0],
      ['E-mail aanwezig', `${withEmail} (${pct(withEmail,total)})`],
      ['Telefoon aanwezig', `${withPhone} (${pct(withPhone,total)})`],
      ['Per gemeente (gem.)', total && gemeenten.length ? (total/gemeenten.length).toFixed(1) : '—'],
      ['Per sport (gem.)', total && sports.length ? (total/sports.length).toFixed(1) : '—'],
    ];

    el.innerHTML = cards.map(([label,value]) => `
      <div class="card" style="padding:12px 14px">
        <div class="muted" style="font-size:.9rem">${label}</div>
        <div style="font-weight:700; font-size:1.4rem; margin-top:4px">${value}</div>
      </div>
    `).join('');
  }

  // -------- Map --------
  async function ensureLeaflet(){
    if (state.leafletReady) return;
    const css = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const js  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const clCss = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    const clCss2= 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    const clJs  = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';

    [css, clCss, clCss2].forEach(href => {
      if (!document.querySelector(`link[href="${href}"]`)){
        const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l);
      }
    });
    if (!window.L){
      await new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = js; s.onload=resolve; s.onerror=reject; document.body.appendChild(s);
      });
    }
    if (!window.L.MarkerClusterGroup){
      await new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = clJs; s.onload=resolve; s.onerror=reject; document.body.appendChild(s);
      });
    }
    state.leafletReady = true;
  }

  function loadCache(){
    try { return JSON.parse(localStorage.getItem('geo_cache_v1') || '{}'); } catch{ return {}; }
  }
  function saveCache(){ localStorage.setItem('geo_cache_v1', JSON.stringify(state.geoCache)); }
  function setGeoStatus(done, total){ document.getElementById('geo-status').textContent = `Geocoding: ${done}/${total}`; }

  function enqueueGeocodes(places){
    const unknown = places.filter(p => !state.geoCache[p]);
    state.geoTotal = unknown.length; state.geoDone = 0; setGeoStatus(0, unknown.length);
    state.geoQueue = unknown;
    if (!unknown.length) return resolveMarkers(places);
    processQueue();
  }

  async function processQueue(){
    if (state.geoInFlight || !state.geoQueue.length) { if(!state.geoQueue.length) resolveMarkers(Object.keys(state.geoCache)); return; }
    state.geoInFlight = 1;
    const place = state.geoQueue.shift();
    try{
      const loc = await geocodePlace(place);
      if (loc) state.geoCache[place] = loc;
      saveCache();
    }catch{}
    state.geoInFlight = 0;
    state.geoDone++; setGeoStatus(state.geoDone, state.geoTotal);
    setTimeout(processQueue, 800);
    resolveMarkers();
  }

  async function geocodePlace(place){
    const q = encodeURIComponent(`${place}, Nederland`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept':'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && json.length){
      const { lat, lon } = json[0];
      return { lat: parseFloat(lat), lng: parseFloat(lon) };
    }
    return null;
  }

  async function initMap(){
    await ensureLeaflet();
    const mapEl = document.getElementById('map');
    if (!state.map){
      state.map = L.map(mapEl).setView([53.1, 5.8], 8); // Friesland
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap'
      }).addTo(state.map);
      state.markers = L.markerClusterGroup();
      state.map.addLayer(state.markers);
    }else{
      state.markers.clearLayers();
    }
  }

  function resolveMarkers(){
    if (!state.map || !state.markers) return;
    state.markers.clearLayers();
    const uniquePlaces = new Set();
    state.filtered.forEach(r => {
      const p = r.__plaats || r['Vestigingsgemeente']; if (!p) return;
      uniquePlaces.add(p);
    });
    const markers = [];
    uniquePlaces.forEach(p => {
      const loc = state.geoCache[p];
      if (!loc) return;
      const m = L.marker([loc.lat, loc.lng], { title: p });
      markers.push(m);
      m.bindPopup(`<strong>${p}</strong>`);
    });
    markers.forEach(m => state.markers.addLayer(m));
    if (markers.length) {
      try { state.map.fitBounds(state.markers.getBounds().pad(0.2)); } catch{}
    }
  }

  async function updateMap(){
    await initMap();
    const places = [...new Set(state.filtered.map(r => r.__plaats || r['Vestigingsgemeente']).filter(Boolean))];
    if (!places.length){ resolveMarkers(); setGeoStatus(0,0); return; }
    enqueueGeocodes(places);
    resolveMarkers();
  }

  // -------- Events --------
  document.getElementById('q').addEventListener('input', applyFilters);
  document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('q').value = '';
    ddGemeente.clear(); ddPlaats.clear(); ddSport.clear(); ddProfit.clear();
    applyFilters();
  });
  document.getElementById('export').addEventListener('click', exportCsv);
  document.getElementById('reload').addEventListener('click', init);

  ddGemeente.setOnChange(applyFilters);
  ddPlaats.setOnChange(applyFilters);
  ddSport.setOnChange(applyFilters);
  ddProfit.setOnChange(applyFilters);

  // -------- Init --------
  await init();

  async function init(){
    try{
      const { rows, total } = await fetchAll();
      state.all = rows; state.total = total;
      hydrateFilters();
      state.filtered = state.all.slice();
      renderKPIs();
      await updateMap();
    }catch(e){
      console.error(e);
      app.querySelector('#map').outerHTML = '<div class="alert">Fout bij laden van data.</div>';
    }
  }

  function exportCsv(){
    const rows = state.filtered.length ? state.filtered : state.all;
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (val) => '\"' + String(val ?? '').replace(/\"/g,'\"\"') + '\"';
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dashboard_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
