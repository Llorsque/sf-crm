
// Trajecten – UI-upgraded (conservatief: geen async/await, geen optional chaining)
import { supabase } from '../supabaseClient.js';

function $(sel){ return document.querySelector(sel); }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn); }
function fmtEur(n){ n = Number(n||0); return n.toLocaleString('nl-NL',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function parseEur(v){ if(v==null) return 0; return parseFloat(String(v).replace(/\./g,'').replace(',','.'))||0; }
function parsePct(v){ if(v==null||v==='') return null; return parseFloat(String(v).replace(',','.')); }
function isoFromNL(v){ if(!v) return null; v=String(v).trim(); var m=v.match(/^(\d{2})-(\d{2})-(\d{4})$/); if(m) return m[3]+'-'+m[2]+'-'+m[1]; var m2=v.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/); return m2?v:null; }
function nlFromISO(v){ if(!v) return ''; var s=String(v).slice(0,10).split('-'); return s.length===3?(s[2]+'-'+s[1]+'-'+s[0]):v; }

var state = { list:[], editId:null, club:null };

// --- UI helpers ---
function statusBadge(status){
  var s = (status||'').toLowerCase();
  var cls = 'badge ';
  if (s==='intake') cls+='badge-intake';
  else if (s==='uitvoering') cls+='badge-uitvoering';
  else if (s==='evaluatie') cls+='badge-evaluatie';
  else if (s==='afgerond') cls+='badge-afgerond';
  else if (s==='geannuleerd') cls+='badge-geannuleerd';
  else cls+='badge-default';
  return '<span class="'+cls+'">'+(status||'-')+'</span>';
}

function typeBadge(t){ return '<span class="badge badge-type">'+(t||'—')+'</span>'; }

function coverage(rec){
  var b = Number(rec.begroot_eur||0);
  var f = Number(rec.financiering_eur||0);
  var e = Number(rec.eigen_eur||0);
  var covered = b>0 ? Math.min(100, Math.round((100*(f+e))/b)) : 0;
  return { covered: covered, rest: Math.max(0, 100-covered) };
}

// --- TEMPLATES ---
function header(){
  return (
`<div class="panel page-trajecten">
  <div class="pagebar">
    <div class="left">
      <h2 class="page-title">Trajecten</h2>
    </div>
    <div class="right">
      <div class="toolbar">
        <label class="lbl">Status</label>
        <select id="f-status-filter" class="input">
          <option value="">Alle</option>
          <option>Intake</option>
          <option>Uitvoering</option>
          <option>Evaluatie</option>
          <option>Afgerond</option>
          <option>Geannuleerd</option>
        </select>
        <button id="btn-new" class="btn primary"><span class="i-plus"></span>Nieuw traject</button>
      </div>
    </div>
  </div>
  <div id="list" class="cards grid"></div>
</div>`);
}

function modalHtml(){
  return (
`<div id="modal-overlay" class="modal-overlay" style="display:none"></div>
<div id="modal" class="panel modal" style="display:none" role="dialog" aria-modal="true">
  <div class="modal-header">
    <h3 id="dlg-title">Nieuw traject</h3>
    <button id="dlg-close" class="icon-btn" aria-label="Sluiten">×</button>
  </div>

  <div class="form grid two">
    <div class="form-field">
      <label>Vereniging (uit database)</label>
      <input id="club-q" class="input" placeholder="Zoek op naam of sport…" autocomplete="off"/>
      <div id="club-dd" class="dropdown"></div>
    </div>
    <div class="form-field">
      <label>Type traject</label>
      <select id="f-type" class="input">
        <option>ClubKaderCoach</option>
        <option>Rabo Clubsupport</option>
        <option>OldStars</option>
        <option>Sportakkoord Traject</option>
      </select>
    </div>

    <div class="form-field">
      <label>Status</label>
      <select id="f-status" class="input">
        <option>Intake</option>
        <option>Uitvoering</option>
        <option>Evaluatie</option>
        <option>Afgerond</option>
        <option>Geannuleerd</option>
      </select>
    </div>
    <div class="form-field">
      <label>Trajectbegeleider</label>
      <select id="f-eigenaar" class="input">
        <option>Aimee</option><option>Allard</option><option>Birgitta</option><option>Demi</option>
        <option>Jorick</option><option>Justin</option><option>Marvin</option><option>Rainer</option><option>Sybren</option><option>Tjardo</option>
      </select>
    </div>

    <div class="form-field">
      <label>Start traject</label>
      <input id="f-start" class="input" placeholder="dd-mm-jjjj"/>
    </div>
    <div class="form-field">
      <label>Verwacht einde</label>
      <input id="f-eind" class="input" placeholder="dd-mm-jjjj"/>
    </div>

    <div class="form-field">
      <label>Begroot (€)</label>
      <input id="f-begroot" class="input right" value="0,00"/>
    </div>
    <div class="form-field">
      <label>Type financiering</label>
      <select id="f-fin-type" class="input">
        <option>SportAkkoord</option><option>Rabo Clubsupport</option><option>Servicelijst</option><option>SIIF</option><option>ander fonds</option>
      </select>
    </div>

    <div class="form-field">
      <label>Financiering %</label>
      <div class="input-group">
        <input id="f-fin-pct" class="input right" placeholder="%"/><span class="addon">%</span>
      </div>
    </div>
    <div class="form-field">
      <label>Financiering €</label>
      <div class="input-group">
        <input id="f-fin-eur" class="input right" value="0,00"/><span class="addon">€</span>
      </div>
    </div>

    <div class="form-field">
      <label>Eigen bijdrage %</label>
      <div class="input-group">
        <input id="f-eigen-pct" class="input right" placeholder="%"/><span class="addon">%</span>
      </div>
    </div>
    <div class="form-field">
      <label>Eigen bijdrage €</label>
      <div class="input-group">
        <input id="f-eigen-eur" class="input right" value="0,00"/><span class="addon">€</span>
      </div>
    </div>

    <div class="form-field full">
      <label>Notities</label>
      <textarea id="f-note" class="input" rows="3"></textarea>
    </div>
  </div>

  <div class="modal-footer">
    <button id="dlg-cancel" class="btn ghost">Annuleren</button>
    <button id="dlg-save" class="btn primary">Opslaan</button>
  </div>
</div>`);
}

// --- RENDER LIST ---
function renderList(){
  var list = $('#list');
  var status = $('#f-status-filter').value;
  var rows = (state.list||[]).filter(function(r){ return !status || r.status===status; });
  if (!rows.length){
    list.innerHTML = '<div class="empty">Nog geen trajecten gevonden.</div>';
    return;
  }
  list.innerHTML = rows.map(function(r){
    var cov = coverage(r);
    return (
      '<article class="card t-card" data-id="'+r.id+'">' +
        '<div class="card-head">' +
          '<h4 class="title">'+ (r.titel || r.club_naam || '-') +'</h4>' +
          '<div class="chips">'+ typeBadge(r.type) + statusBadge(r.status) +'</div>' +
        '</div>' +
        '<div class="meta-row">' +
          '<span class="chip">Begroot: € '+ fmtEur(r.begroot_eur) +'</span>' +
          '<span class="chip">Dekking: '+ cov.covered +'%</span>' +
        '</div>' +
        '<div class="actions"><button class="btn-secondary btn-edit" data-id="'+r.id+'">Bewerken</button></div>' +
      '</article>'
    );
  }).join('');
}

// --- DATA ---
function loadList(){
  $('#list').innerHTML = '<div class="loading-row">Laden…</div>';
  supabase.from('trajecten').select('*').order('created_at',{ascending:false})
    .then(function({data,error}){
      if(error){ console.error(error); $('#list').innerHTML = '<div class="alert err">Laden mislukt</div>'; return; }
      state.list = data||[]; renderList();
    });
}

// --- FORM HELPERS ---
function prefill(r){
  if (!r) return;
  $('#dlg-title').textContent = 'Traject bewerken';
  $('#f-type').value = r.type || $('#f-type').value;
  $('#f-status').value = r.status || $('#f-status').value;
  $('#f-eigenaar').value = r.eigenaar || $('#f-eigenaar').value;
  $('#f-start').value = nlFromISO(r.start_datum);
  $('#f-eind').value = nlFromISO(r.eind_datum);
  $('#f-begroot').value = fmtEur(r.begroot_eur);
  $('#f-fin-type').value = r.financiering_type || $('#f-fin-type').value;
  $('#f-fin-pct').value = r.financiering_pct==null ? '' : String(r.financiering_pct).replace('.',',');
  $('#f-fin-eur').value = fmtEur(r.financiering_eur);
  $('#f-eigen-pct').value = r.eigen_pct==null ? '' : String(r.eigen_pct).replace('.',',');
  $('#f-eigen-eur').value = fmtEur(r.eigen_eur);
  $('#f-note').value = r.notities || '';
  $('#club-q').value = r.club_naam ? (r.club_naam + ' (#' + (r.club_nr||'') + ')') : '';
  state.club = r.club_nr ? {'Nr.':r.club_nr,'Naam':r.club_naam,'Vestigingsgemeente':r.gemeente||''} : null;
}

function collect(){
  var begroot = parseEur($('#f-begroot').value);
  var finPct = parsePct($('#f-fin-pct').value);
  var finEur = parseEur($('#f-fin-eur').value);
  var eigPct = parsePct($('#f-eigen-pct').value);
  var eigEur = parseEur($('#f-eigen-eur').value);
  if (begroot>0){
    if (finPct!=null && (!finEur || finEur===0)) finEur = begroot*(finPct/100);
    if (finEur && finEur>0 && (finPct==null || finPct===0)) finPct = 100*finEur/begroot;
    if (eigPct!=null && (!eigEur || eigEur===0)) eigEur = begroot*(eigPct/100);
    if (eigEur && eigEur>0 && (eigPct==null || eigPct===0)) eigPct = 100*eigEur/begroot;
  }
  var club = state.club || {};
  return {
    club_nr: club['Nr.']?String(club['Nr.']):null, club_naam: club['Naam']||null, gemeente: club['Vestigingsgemeente']||null,
    titel: club['Naam']||null, type: $('#f-type').value, status: $('#f-status').value, eigenaar: $('#f-eigenaar').value, notities: $('#f-note').value||null,
    start_datum: isoFromNL($('#f-start').value), eind_datum: isoFromNL($('#f-eind').value), laatste_update: null,
    begroot_eur: begroot||0, financiering_type: $('#f-fin-type').value, financiering_pct: finPct, financiering_eur: finEur||0, eigen_pct: eigPct, eigen_eur: eigEur||0
  };
}

// --- FINANCE BINDINGS ---
function bindFinance(){
  var lock=false;
  function fromPct(){ if(lock) return; lock=true; var b=parseEur($('#f-begroot').value), p=parsePct($('#f-fin-pct').value), ep=parsePct($('#f-eigen-pct').value);
    if(b>0 && p!=null) $('#f-fin-eur').value = fmtEur(b*(p/100));
    if(b>0 && ep!=null) $('#f-eigen-eur').value = fmtEur(b*(ep/100));
    lock=false; }
  function fromEur(){ if(lock) return; lock=true; var b=parseEur($('#f-begroot').value), e=parseEur($('#f-fin-eur').value), ee=parseEur($('#f-eigen-eur').value);
    if(b>0 && e) $('#f-fin-pct').value = String((100*e/b).toFixed(2)).replace('.',',');
    if(b>0 && ee) $('#f-eigen-pct').value = String((100*ee/b).toFixed(2)).replace('.',',');
    lock=false; }
  ['f-begroot','f-fin-pct','f-eigen-pct'].forEach(function(id){ on($('#'+id),'input',fromPct); });
  ['f-fin-eur','f-eigen-eur'].forEach(function(id){ on($('#'+id),'input',fromEur); });
}

// --- CLUB SEARCH ---
function bindClubSearch(){
  var dd = $('#club-dd');
  function search(q){
    if (!q || q.length<2){ dd.innerHTML=''; return; }
    var expr = 'Naam.ilike.%'+q+'%, "Subsoort organisatie".ilike.%'+q+'%';
    supabase.from('clubs').select('"Nr.", Naam, "Vestigingsgemeente"').or(expr).limit(10)
      .then(function({data,error}){
        if (error){ console.error(error); dd.innerHTML='<div class="dd-empty">Zoeken mislukt</div>'; return; }
        if (!data || !data.length){ dd.innerHTML='<div class="dd-empty">Geen resultaten</div>'; return; }
        dd.innerHTML = data.map(function(r){
          return '<div class="opt" data-nr="'+r['Nr.']+'" data-naam="'+(r['Naam']||'')+'" data-gem="'+(r['Vestigingsgemeente']||'')+'">'
               + (r['Naam']||'') + ' <small>#'+r['Nr.']+'</small></div>';
        }).join('');
      });
  }
  on($('#club-q'),'input',function(e){ search(e.target.value.trim()); });
  on(dd,'click',function(e){
    var opt=e.target.closest('.opt'); if(!opt) return;
    state.club={'Nr.':opt.getAttribute('data-nr'),'Naam':opt.getAttribute('data-naam'),'Vestigingsgemeente':opt.getAttribute('data-gem')};
    $('#club-q').value = opt.getAttribute('data-naam') + ' (#' + opt.getAttribute('data-nr') + ')';
    dd.innerHTML='';
  });
}

// --- MOUNT ---
export default function mount(app){
  app.innerHTML = header() + modalHtml();

  // Modal & bindings
  var modalCtl = (function(){ var ov=$('#modal-overlay'), md=$('#modal'); return {
    open:function(){ ov.style.display='block'; md.style.display='block'; },
    close:function(){ ov.style.display='none'; md.style.display='none'; state.editId=null; state.club=null; $('#dlg-title').textContent='Nieuw traject'; }
  }; })();
  on($('#dlg-close'),'click',function(){ modalCtl.close(); });
  on($('#dlg-cancel'),'click',function(){ modalCtl.close(); });

  bindFinance();
  bindClubSearch();

  // Filters
  on($('#f-status-filter'),'change',function(){ renderList(); });

  // Nieuw
  on($('#btn-new'),'click',function(){
    state.editId=null; state.club=null;
    $('#dlg-title').textContent='Nieuw traject';
    var ids=['club-q','f-start','f-eind','f-begroot','f-fin-pct','f-fin-eur','f-eigen-pct','f-eigen-eur','f-note'];
    for (var i=0;i<ids.length;i++){ var el=$('#'+ids[i]); if(el) el.value=''; }
    $('#f-begroot').value='0,00'; $('#f-fin-eur').value='0,00'; $('#f-eigen-eur').value='0,00';
    modalCtl.open();
  });

  // Klik op kaart/bewerken
  document.addEventListener('click',function(e){
    var btn=e.target.closest('.btn-edit');
    var card=e.target.closest('.t-card');
    var id=(btn&&btn.getAttribute('data-id'))||(card&&card.getAttribute('data-id'));
    if(!id) return;
    var r=(state.list||[]).find(function(x){ return String(x.id)===String(id); });
    if(r){ state.editId=r.id; prefill(r); modalCtl.open(); }
  });

  // Opslaan
  on($('#dlg-save'),'click',function(){
    var payload = collect();
    var req = state.editId ? supabase.from('trajecten').update(payload).eq('id', state.editId)
                           : supabase.from('trajecten').insert(payload);
    req.then(function({error}){
      if(error){ console.error(error); alert('Opslaan mislukt: '+(error.message||error)); return; }
      modalCtl.close();
      loadList();
    });
  });

  // init
  loadList();
}
