import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div><h2 style="margin:0">Trajecten</h2><div class="muted">Stap 1: Club kiezen → Stap 2: Details → Opslaan</div></div>
        <div style="display:flex; gap:8px">
          <button id="btn-new" class="btn-accent">➕ Nieuw traject</button>
          <button id="btn-refresh" class="btn-accent">🔄 Ververs</button>
        </div>
      </div>
    </div>

    <div id="wizard" class="card" style="display:none; padding:16px">
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px">
        <span class="pill">1 • Club</span><span>→</span><span class="pill muted">2 • Details</span>
      </div>
      <div id="step-1"></div>
      <div id="step-2" style="display:none"></div>
    </div>

    <div class="card">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px">
        <input id="q" class="filter-input" placeholder="🔍 Zoek op club of titel…">
        <select id="f-status" class="filter-input" style="max-width:220px">
          <option value="">Alle status</option>
          <option>Nieuw</option>
          <option>Lopend</option>
          <option>Afgerond</option>
          <option>Gepauzeerd</option>
        </select>
      </div>
      <div id="list" class="grid"></div>
    </div>
  `;

  const $ = (s)=> app.querySelector(s);
  const state = { rows: [], filtered: [] , club:null };

  // NEW
  $('#btn-new').addEventListener('click', () => { showWizard(); renderStep1(); });
  $('#btn-refresh').addEventListener('click', init);

  function showWizard(){ $('#wizard').style.display='block'; }
  function goStep(n){
    $('#step-1').style.display = n===1? 'block':'none';
    $('#step-2').style.display = n===2? 'block':'none';
  }

  // Step 1 — club kiezen (uit Supabase 'clubs')
  async function renderStep1(){
    $('#step-1').innerHTML = `
      <label style="font-weight:700">Kies club uit CRM (Supabase)</label>
      <input id="club-q" class="filter-input" placeholder="🔍 Zoeken op naam of Nr.…">
      <div id="club-results" class="grid" style="margin-top:10px"></div>
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:flex-end">
        <button id="s1-next" class="btn-accent" disabled>Volgende →</button>
      </div>
    `;
    $('#club-q').addEventListener('input', debounce(searchClubs, 250));
    $('#s1-next').addEventListener('click', () => renderStep2());

    async function searchClubs(){
      const q = $('#club-q').value.trim();
      const { data, error } = await supabase
        .from('clubs')
        .select('"Nr.", "Naam", "Vestigingsgemeente", "Postadres"')
        .or(`Naam.ilike.%${q}%, "Nr.".eq.${q}`)
        .limit(24);
      if (error){ console.error(error); return; }
      $('#club-results').innerHTML = (data||[]).map(r => `
        <article class="card">
          <h3>${r['Naam']}</h3>
          <div class="meta">Nr: ${r['Nr.']}</div>
          <div class="meta">${r['Vestigingsgemeente'] || ''} • ${(r['Postadres']||'')}</div>
          <button class="btn-accent choose" data-nr="${r['Nr.']}">Kies</button>
        </article>
      `).join('');

      app.querySelectorAll('.choose').forEach(btn => {
        btn.addEventListener('click', () => {
          const nr = btn.dataset.nr;
          const club = (data||[]).find(x => String(x['Nr.'])===String(nr));
          state.club = club;
          $('#s1-next').disabled = !club;
        });
      });
    }
    $('#club-q').value=''; state.club=null; $('#s1-next').disabled=true; searchClubs();
  }

  // Step 2 — details + opslaan naar 'trajecten'
  function renderStep2(){
    if (!state.club){ alert('Kies eerst een club.'); return; }
    goStep(2);
    $('#step-2').innerHTML = `
      <div class="grid">
        <div class="card">
          <label>Club</label>
          <div><strong>${state.club['Naam']}</strong> <span class="muted">(#${state.club['Nr.']})</span></div>
          <div class="muted">${state.club['Vestigingsgemeente']||''} • ${(state.club['Postadres']||'')}</div>
        </div>
        <div class="card">
          <label>Titel</label>
          <input id="f-titel" class="filter-input" placeholder="Bijv. Verduurzaming sportpark"/>
          <label style="margin-top:8px">Type</label>
          <select id="f-type" class="filter-input">
            <option>Begeleiding</option>
            <option>Cursus</option>
            <option>Advies</option>
            <option>Traject</option>
          </select>
          <label style="margin-top:8px">Status</label>
          <select id="f-status" class="filter-input">
            <option>Nieuw</option>
            <option selected>Lopend</option>
            <option>Afgerond</option>
            <option>Gepauzeerd</option>
          </select>
        </div>
        <div class="card">
          <label>Startdatum</label>
          <input type="date" id="f-start" class="filter-input"/>
          <label style="margin-top:8px">Einddatum</label>
          <input type="date" id="f-eind" class="filter-input"/>
          <label style="margin-top:8px">Eigenaar/coach</label>
          <input id="f-owner" class="filter-input" placeholder="Naam traject-eigenaar"/>
        </div>
        <div class="card">
          <label>Notities</label>
          <textarea id="f-note" class="filter-input" rows="6" placeholder="Korte omschrijving…"></textarea>
          <label style="margin-top:8px">Tags (komma-gescheiden)</label>
          <input id="f-tags" class="filter-input" placeholder="bijv. energie, jeugd, kunstgras"/>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px; justify-content:space-between">
        <button id="back" class="btn-accent">← Terug</button>
        <button id="save" class="btn-accent">💾 Opslaan</button>
      </div>
    `;
    $('#back').addEventListener('click', () => { goStep(1); renderStep1(); });
    $('#save').addEventListener('click', saveTraject);
  }

  async function saveTraject(){
    const club = state.club;
    const payload = {
      club_nr: String(club['Nr.']),
      club_naam: club['Naam'],
      titel: $('#f-titel').value.trim() || `Traject ${club['Naam']}`,
      type: $('#f-type').value,
      status: $('#f-status').value,
      start_datum: $('#f-start').value || null,
      eind_datum: $('#f-eind').value || null,
      eigenaar: $('#f-owner').value.trim() || null,
      notities: $('#f-note').value.trim() || null,
      tags: $('#f-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
      gemeente: club['Vestigingsgemeente'] || null,
      plaats: extractPlaats(club['Postadres']||'') || null
    };
    if (!payload.tags.length) payload.tags = null;

    const { error } = await supabase.from('trajecten').insert(payload);
    if (error){ console.error(error); alert('Opslaan mislukt (tabel/policies?).'); return; }
    alert('Traject opgeslagen!');
    $('#wizard').style.display='none';
    init();
  }

  // Overview (eenvoudig)
  $('#q').addEventListener('input', debounce(applyFilters, 200));
  $('#f-status').addEventListener('change', applyFilters);

  async function init(){
    const { data, error } = await supabase.from('trajecten').select('*').order('created_at', { ascending:false }).limit(500);
    if (error){ console.warn('Nog geen tabel/policy? Draai supabase-trajecten.sql', error); return; }
    state.rows = data||[]; applyFilters();
  }

  function applyFilters(){
    const q = ($('#q')?.value||'').toLowerCase();
    const st = $('#f-status')?.value||'';
    state.filtered = state.rows.filter(r => {
      const okQ = !q || (r.club_naam||'').toLowerCase().includes(q) || (r.titel||'').toLowerCase().includes(q);
      const okS = !st || r.status===st;
      return okQ && okS;
    });
    renderList();
  }

  function renderList(){
    $('#list').innerHTML = state.filtered.map(r => `
      <article class="card">
        <h3>${r.titel || 'Traject'}</h3>
        <div class="meta">🏟️ ${r.club_naam} <span class="muted">(#${r.club_nr})</span></div>
        <div class="meta">📅 ${r.start_datum || '—'} → ${r.eind_datum || '—'}</div>
        <div class="meta">🏷️ ${r.type || '—'} • <strong>${r.status}</strong></div>
      </article>
    `).join('');
  }

  function extractPlaats(postadres=''){
    if (!postadres) return '';
    const m = postadres.match(/\b\d{4}\s?[A-Z]{2}\s+(.+)/i);
    if (m) return m[1].trim();
    const parts = postadres.split(/[;\n,]/).map(s=>s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); }; }

  // Boot
  init();
}
