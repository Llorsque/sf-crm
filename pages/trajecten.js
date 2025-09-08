import { supabase } from '../supabaseClient.js';

export default async function mount(app){
  app.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div><h2 style="margin:0">Trajecten</h2><div class="muted">Voeg trajecten toe, gekoppeld aan clubs uit het CRM</div></div>
        <div style="display:flex; gap:8px">
          <button id="btn-new" class="btn-accent">➕ Nieuw traject</button>
          <button id="btn-refresh" class="btn-accent">🔄 Ververs</button>
          <button id="btn-export" class="btn-accent">⬇️ Export</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px">
        <input id="q" class="filter-input" placeholder="🔍 Zoek op club of titel…">
        <select id="f-status" class="filter-input" style="max-width:220px">
          <option value="">Alle status</option>
          <option>Nieuw</option>
          <option selected>Lopend</option>
          <option>Afgerond</option>
          <option>Gepauzeerd</option>
        </select>
        <select id="f-stage" class="filter-input" style="max-width:220px">
          <option value="">Alle stages</option>
          <option>Intake</option>
          <option>Uitvoering</option>
          <option>Evaluatie</option>
        </select>
      </div>
      <div id="list" class="grid"></div>
    </div>

    <!-- Modal -->
    <div id="modal-overlay" class="overlay"></div>
    <div id="modal" class="modal">
      <div class="modal-head">
        <h3>Nieuw traject</h3>
        <button id="modal-close" class="icon-btn">✖</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field">
            <label>Vereniging (uit database)</label>
            <div class="club-picker">
              <input id="club-q" class="filter-input" placeholder="Zoek/Selecteer club…" autocomplete="off"/>
              <div id="club-dd" class="club-dd"></div>
            </div>
          </div>
          <div class="field">
            <label>Type traject</label>
            <select id="f-type" class="filter-input">
              <option>ClubKaderCoach</option>
              <option>Rabo Clubsupport</option>
              <option>OldStars</option>
              <option>Sportakkoord Traject</option>
            </select>
          </div>
          <div class="field">
            <label>Clubondersteuner</label>
            <select id="f-eigenaar" class="filter-input">
              <option>Aimee</option>
              <option>Allard</option>
              <option>Birgitta</option>
              <option>Demi</option>
              <option>Jorick</option>
              <option>Justin</option>
              <option>Marvin</option>
              <option>Rainer</option>
              <option>Sybren</option>
              <option>Tjardo</option>
            </select>
          </div>
          <div class="field">
            <label>Trajectbegeleider</label>
            <input id="f-begeleider" class="filter-input" placeholder="Naam"/>
          </div>
          <div class="field">
            <label>Start traject</label>
            <input type="date" id="f-start" class="filter-input"/>
          </div>
          <div class="field">
            <label>Verwacht einde</label>
            <input type="date" id="f-eind" class="filter-input"/>
          </div>
          <div class="field">
            <label>Begroot (€)</label>
            <input id="f-begroot" class="filter-input" inputmode="decimal" value="0.00"/>
          </div>
          <div class="field">
            <label>Type financiering</label>
            <select id="f-fin-type" class="filter-input">
              <option>SportAkkoord</option>
              <option>Rabo Clubsupport</option>
              <option>Servicelijst</option>
              <option>SIIF</option>
              <option>ander fonds</option>
            </select>
          </div>
          <div class="field">
            <label>Financiering %</label>
            <input id="f-fin-pct" class="filter-input" inputmode="numeric" value="0"/>
          </div>
          <div class="field">
            <label>Financiering €</label>
            <input id="f-fin-eur" class="filter-input" inputmode="decimal" value="0,00"/>
          </div>
          <div class="field">
            <label>Eigen bijdrage %</label>
            <input id="f-eigen-pct" class="filter-input" inputmode="numeric" value="0"/>
          </div>
          <div class="field">
            <label>Eigen bijdrage €</label>
            <input id="f-eigen-eur" class="filter-input" inputmode="decimal" value="0,00"/>
          </div>
          <div class="field span-2">
            <div id="dekking" class="muted">Dekking: 0.0% (0.00 EUR) • Restant: 100.0% (0.00 EUR)</div>
          </div>
          <div class="field">
            <label>Status</label>
            <select id="f-stage-new" class="filter-input">
              <option>Intake</option>
              <option>Uitvoering</option>
              <option>Evaluatie</option>
              <option>Afgerond</option>
              <option>Geannuleerd</option>
            </select>
          </div>
          <div class="field">
            <label>Laatste update</label>
            <input type="date" id="f-last" class="filter-input"/>
          </div>
          <div class="field span-2">
            <label>Notities</label>
            <textarea id="f-note" class="filter-input" rows="5" placeholder=""></textarea>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button id="modal-cancel" class="btn-secondary">Annuleren</button>
        <button id="modal-save" class="btn-accent">Opslaan</button>
      </div>
    </div>
  `;

  injectStyles();

  const $ = (s)=> app.querySelector(s);
  const state = { list: [], club:null };

  // List filters + boot
  $('#btn-new').addEventListener('click', openModal);
  $('#btn-refresh').addEventListener('click', init);
  $('#btn-export').addEventListener('click', exportCsv);
  $('#q').addEventListener('input', debounce(renderList, 200));
  $('#f-status').addEventListener('change', renderList);
  $('#f-stage').addEventListener('change', renderList);

  await init();

  async function init(){
    const { data, error } = await supabase.from('trajecten').select('*').order('created_at', { ascending:false }).limit(1000);
    if (error) { console.error(error); state.list = []; }
    else state.list = data || [];
    renderList();
  }

  function renderList(){
    const q = ($('#q')?.value||'').toLowerCase();
    const st = $('#f-status')?.value||'';
    const sg = $('#f-stage')?.value||'';
    const rows = state.list.filter(r => {
      const okQ = !q || (r.club_naam||'').toLowerCase().includes(q) || (r.titel||'').toLowerCase().includes(q);
      const okS = !st || r.status===st;
      const okG = !sg || r.stage===sg;
      return okQ && okS && okG;
    });
    $('#list').innerHTML = rows.map(r => `
      <article class="card">
        <h3>${r.titel || (r.type || 'Traject')}</h3>
        <div class="meta">🏟️ ${r.club_naam} <span class="muted">(#${r.club_nr})</span></div>
        <div class="meta">📅 ${r.start_datum || '—'} → ${r.eind_datum || '—'}</div>
        <div class="meta">🏷️ ${r.type || '—'} • <strong>${r.status}</strong> • ${r.stage || '-'}</div>
      </article>
    `).join('');
  }

  // Modal
  function openModal(){
    state.club = null;
    $('#modal-overlay').classList.add('show');
    $('#modal').classList.add('open');
    $('#modal-close').onclick = closeModal;
    $('#modal-cancel').onclick = closeModal;
    $('#modal-save').onclick = save;
    // defaults
    const today = new Date().toISOString().slice(0,10);
    $('#f-last').value = today;
    // club search events
    $('#club-q').addEventListener('input', debounce(searchClubs, 250));
    $('#club-dd').innerHTML = '';
    // calculate coverage
    ['f-begroot','f-fin-pct','f-fin-eur','f-eigen-pct','f-eigen-eur'].forEach(id=>{
      $('#'+id).addEventListener('input', calcCoverage);
    });
    calcCoverage();
  }

  function closeModal(){
    $('#modal-overlay').classList.remove('show');
    $('#modal').classList.remove('open');
  }

  async function searchClubs(){
    const q = $('#club-q').value.trim();
    const { data, error } = await supabase
      .from('clubs')
      .select('"Nr.", "Naam", "Vestigingsgemeente", "Postadres"')
      .or(`Naam.ilike.%${q}%, "Subsoort organisatie".ilike.%${q}%, "Nr.".eq.${q}`)
      .limit(15);
    if (error){ console.error(error); return; }
    $('#club-dd').innerHTML = (data||[]).map(r => `
      <button class="dd-item" data-nr="${r['Nr.']}">
        <div class="dd-title">${r['Naam']}</div>
        <div class="dd-sub">${r['Vestigingsgemeente']||''} • ${(r['Postadres']||'')}</div>
      </button>
    `).join('');
    Array.from($('#club-dd').querySelectorAll('.dd-item')).forEach(btn => {
      btn.addEventListener('click', ()=>{
        const nr = btn.dataset.nr;
        const club = (data||[]).find(x => String(x['Nr.'])===String(nr));
        state.club = club;
        $('#club-q').value = `${club['Naam']} (#${club['Nr.']})`;
        $('#club-dd').innerHTML = '';
      });
    });
  }

  function parseMoney(val){ if (!val) return 0; return parseFloat(String(val).replace(/[€\s\.]/g,'').replace(',', '.')) || 0; }
  function parsePct(val){ return parseFloat(String(val).replace(',', '.')) || 0; }
  
function calcCoverage(){
  const begroot = parseMoney($('#f-begroot').value);

  // read current values
  let finPct  = parsePct($('#f-fin-pct').value);
  let finEur  = parseMoney($('#f-fin-eur').value);
  let eigPct  = parsePct($('#f-eigen-pct').value);
  let eigEur  = parseMoney($('#f-eigen-eur').value);

  // Decide direction based on active input to avoid fighting
  const activeId = document.activeElement && document.activeElement.id;

  if (begroot > 0){
    // Financiering
    if (activeId === 'f-fin-pct' || (finPct && !finEur)){
      finEur = begroot * (finPct/100);
      $('#f-fin-eur').value = finEur.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (activeId === 'f-fin-eur' || (finEur && !finPct)){
      finPct = 100 * finEur / begroot;
      // One decimal is usually enough for percentages
      $('#f-fin-pct').value = finPct.toFixed(1).replace('.',',');
    }

    // Eigen bijdrage
    if (activeId === 'f-eigen-pct' || (eigPct && !eigEur)){
      eigEur = begroot * (eigPct/100);
      $('#f-eigen-eur').value = eigEur.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (activeId === 'f-eigen-eur' || (eigEur && !eigPct)){
      eigPct = 100 * eigEur / begroot;
      $('#f-eigen-pct').value = eigPct.toFixed(1).replace('.',',');
    }
  }

  const dekking = (finEur + eigEur);
  const dekPct = begroot>0 ? 100*dekking/begroot : 0;
  const rest = Math.max(0, begroot - dekking);
  const restPct = begroot>0 ? 100*rest/begroot : 100;

  $('#dekking').textContent = `Dekking: ${dekPct.toFixed(1)}% (${dekking.toLocaleString('nl-NL',{style:'currency',currency:'EUR'})}) • Restant: ${restPct.toFixed(1)}% (${rest.toLocaleString('nl-NL',{style:'currency',currency:'EUR'})})`;
}
% (${(dekking||0).toLocaleString('nl-NL',{style:'currency',currency:'EUR'})}) • Restant: ${restPct.toFixed(1)}% (${(rest||0).toLocaleString('nl-NL',{style:'currency',currency:'EUR'})})`;
  }

  async function save(){
    if (!state.club){ alert('Kies eerst een club.'); return; }
    const payload = {
      club_nr: String(state.club['Nr.']),
      club_naam: state.club['Naam'],
      titel: $('#f-type').value || 'Traject',
      type: $('#f-type').value || null,
      status: 'Lopend',
      start_datum: $('#f-start').value || null,
      eind_datum: $('#f-eind').value || null,
      eigenaar: $('#f-eigenaar').value || $('#f-begeleider').value || null,
      notities: $('#f-note').value || null,
      tags: null,
      gemeente: state.club['Vestigingsgemeente'] || null,
      plaats: extractPlaats(state.club['Postadres']||'') || null,
      begroot_eur: parseMoney($('#f-begroot').value) || null,
      financiering_type: $('#f-fin-type').value || null,
      financiering_pct: parsePct($('#f-fin-pct').value) || null,
      financiering_eur: parseMoney($('#f-fin-eur').value) || null,
      eigen_pct: parsePct($('#f-eigen-pct').value) || null,
      eigen_eur: parseMoney($('#f-eigen-eur').value) || null,
      stage: $('#f-stage-new').value || null,
      laatste_update: $('#f-last').value || null
    };
    const { error } = await supabase.from('trajecten').insert(payload);
    if (error){ console.error(error); alert('Opslaan mislukt. Controleer of de tabel en policies bestaan.'); return; }
    closeModal();
    await init();
  }

  function extractPlaats(postadres=''){
    if (!postadres) return '';
    const m = postadres.match(/\b\d{4}\s?[A-Z]{2}\s+(.+)/i);
    if (m) return m[1].trim();
    const parts = postadres.split(/[;\n,]/).map(s=>s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length-1] : '';
  }

  function exportCsv(){
    const rows = state.list;
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (v)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'trajecten.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); }; }

  function injectStyles(){
    const css = `
      .modal{position:fixed; inset:auto 20px 20px 20px; top:20px; max-width:980px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 10px 40px rgba(20,28,58,.22); display:none; flex-direction:column; max-height:calc(100vh - 40px);}
      .modal.open{display:flex;}
      .modal-head, .modal-foot{padding:12px 16px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #eef0f6;}
      .modal-foot{border-top:1px solid #eef0f6; border-bottom:none;}
      .modal-body{padding:16px; overflow:auto;}
      .overlay{position:fixed; inset:0; background:rgba(23,31,55,.4); opacity:0; pointer-events:none; transition:.2s;}
      .overlay.show{opacity:1; pointer-events:all;}
      .form-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
      .field{display:flex; flex-direction:column;}
      .field.span-2{grid-column:1 / -1;}
      .club-picker{position:relative;}
      .club-dd{position:absolute; z-index:20; left:0; right:0; top:100%; background:#fff; border:1px solid #e7eaf3; border-radius:12px; box-shadow:0 8px 30px rgba(20,28,58,.12); overflow:hidden; max-height:240px; overflow:auto;}
      .dd-item{display:block; width:100%; text-align:left; padding:10px 12px; border-bottom:1px solid #f2f4f9;}
      .dd-item:hover{background:#f6fbfb;}
      .dd-title{font-weight:700;}
      .dd-sub{font-size:.9rem; color:#6b7280;}
      .icon-btn{background:#f2f4f9; border:none; padding:8px 10px; border-radius:10px; cursor:pointer;}
      .btn-secondary{background:#eef2f8; border:none; padding:10px 14px; border-radius:12px; font-weight:700; cursor:pointer;}
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }
}
