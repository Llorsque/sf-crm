// v21 – Trajecten (conservatief; zonder async/await/optional chaining)
import { supabase } from '../supabaseClient.js';

function $(sel){ return document.querySelector(sel); }
function on(el,ev,fn){ el && el.addEventListener(ev,fn); }
function fmtEur(n){ n = Number(n||0); return n.toLocaleString('nl-NL',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function parseEur(v){ if(v==null) return 0; return parseFloat(String(v).replace(/\./g,'').replace(',','.'))||0; }
function parsePct(v){ if(v==null||v==='') return null; return parseFloat(String(v).replace(',','.')); }
function isoFromNL(v){ if(!v) return null; v=String(v).trim(); var m=v.match(/^(\d{2})-(\d{2})-(\d{4})$/); if(m) return m[3]+'-'+m[2]+'-'+m[1]; var m2=v.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m2?v:null; }
function nlFromISO(v){ if(!v) return ''; var s=String(v).slice(0,10).split('-'); return s.length===3?(s[2]+'-'+s[1]+'-'+s[0]):v; }

var state = { list:[], editId:null, club:null };

function view(){
  return (
`<div class="panel">
  <div class="toolbar" style="display:flex;gap:8px;align-items:center">
    <button id="btn-new" class="btn">Nieuw traject</button>
    <div style="margin-left:auto">
      <label class="mute" style="font-size:12px">Status</label>
      <select id="f-status-filter">
        <option value="">Alle</option>
        <option>Intake</option>
        <option>Uitvoering</option>
        <option>Evaluatie</option>
        <option>Afgerond</option>
        <option>Geannuleerd</option>
      </select>
    </div>
  </div>
  <div id="list" class="cards" style="margin-top:12px"></div>
</div>

<div id="modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);"></div>
<div id="modal" class="panel" style="display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-height:85vh;overflow:auto;width:880px;z-index:1000">
  <div style="display:flex;align-items:center;gap:8px;">
    <h3 style="margin:0;flex:1" id="dlg-title">Nieuw traject</h3>
    <button id="dlg-close" class="btn-secondary">×</button>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
    <div>
      <label>Vereniging (uit database)</label>
      <input id="club-q" placeholder="Zoek op naam/sport…"/>
      <div id="club-dd" class="dropdown"></div>
    </div>
    <div>
      <label>Type traject</label>
      <select id="f-type">
        <option>ClubKaderCoach</option>
        <option>Rabo Clubsupport</option>
        <option>OldStars</option>
        <option>Sportakkoord Traject</option>
      </select>
    </div>
    <div>
      <label>Status</label>
      <select id="f-status">
        <option>Intake</option>
        <option>Uitvoering</option>
        <option>Evaluatie</option>
        <option>Afgerond</option>
        <option>Geannuleerd</option>
      </select>
    </div>
    <div>
      <label>Trajectbegeleider</label>
      <select id="f-eigenaar">
        <option>Aimee</option><option>Allard</option><option>Birgitta</option><option>Demi</option><option>Jorick</option><option>Justin</option><option>Marvin</option><option>Rainer</option><option>Sybren</option><option>Tjardo</option>
      </select>
    </div>
    <div><label>Start</label><input id="f-start" placeholder="dd-mm-jjjj"/></div>
    <div><label>Einde</label><input id="f-eind" placeholder="dd-mm-jjjj"/></div>
    <div><label>Begroot (€)</label><input id="f-begroot" value="0,00"/></div>
    <div><label>Type financiering</label>
      <select id="f-fin-type"><option>SportAkkoord</option><option>Rabo Clubsupport</option><option>Servicelijst</option><option>SIIF</option><option>ander fonds</option></select>
    </div>
    <div><label>Financiering %</label><input id="f-fin-pct" placeholder="%"/></div>
    <div><label>Financiering €</label><input id="f-fin-eur" value="0,00"/></div>
    <div><label>Eigen bijdrage %</label><input id="f-eigen-pct" placeholder="%"/></div>
    <div><label>Eigen bijdrage €</label><input id="f-eigen-eur" value="0,00"/></div>
    <div style="grid-column:1/3"><label>Notities</label><textarea id="f-note" rows="3"></textarea></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
    <button id="dlg-cancel" class="btn-secondary">Annuleren</button>
    <button id="dlg-save" class="btn">Opslaan</button>
  </div>
</div>`);
}

function bindModal(){
  var ov=$('#modal-overlay'), md=$('#modal');
  function open(){ ov.style.display='block'; md.style.display='block'; }
  function close(){ ov.style.display='none'; md.style.display='none'; state.editId=null; state.club=null; $('#dlg-title').textContent='Nieuw traject'; }
  on($('#dlg-close'),'click',function(){ close(); });
  on($('#dlg-cancel'),'click',function(){ close(); });
  return { open:open, close:close };
}

function renderList(){
  var status = $('#f-status-filter').value;
  var rows = (state.list||[]).filter(function(r){ return !status || r.status===status; });
  var list = $('#list');
  if (!rows.length){ list.innerHTML='<div class="mute...">Geen trajecten.</div>'; return; }
  list.innerHTML = rows.map(function(r){
    return '<article class="card t-card" data-id="'+r.id+'">'
      + '<h4 style="margin:0 0 6px 0">'+(r.titel||r.club_naam||'-')+'</h4>'
      + '<div class="meta">🏷️ '+(r.type||'—')+' • <strong>'+(r.status||'-')+'</strong></div>'
      + '<div style="margin-top:6px">Begroot: € '+fmtEur(r.begroot_eur)+'</div>'
      + '<div style="margin-top:8px"><button class="btn-secondary btn-edit" data-id="'+r.id+'">Bewerken</button></div>'
      + '</article>';
  }).join('');
}

function loadList(){
  $('#list').innerHTML = '<div class="panel">Laden…</div>';
  supabase.from('trajecten').select('*').order('created_at',{ascending:false})
    .then(function({data,error}){
      if(error){ console.error(error); $('#list').innerHTML='<div class="alert err">Laden mislukt</div>'; return; }
      state.list = data||[]; renderList();
    });
}

function prefill(r){
  $('#dlg-title').textContent='Traject bewerken';
  $('#f-type').value = r.type||$('#f-type').value;
  $('#f-status').value = r.status||$('#f-status').value;
  $('#f-eigenaar').value = r.eigenaar||$('#f-eigenaar').value;
  $('#f-start').value = nlFromISO(r.start_datum);
  $('#f-eind').value = nlFromISO(r.eind_datum);
  $('#f-begroot').value = fmtEur(r.begroot_eur);
  $('#f-fin-type').value = r.financiering_type||$('#f-fin-type').value;
  $('#f-fin-pct').value = r.financiering_pct==null?'':String(r.financiering_pct).replace('.',',');
  $('#f-fin-eur').value = fmtEur(r.financiering_eur);
  $('#f-eigen-pct').value = r.eigen_pct==null?'':String(r.eigen_pct).replace('.',',');
  $('#f-eigen-eur').value = fmtEur(r.eigen_eur);
  $('#f-note').value = r.notities||'';
  $('#club-q').value = r.club_naam ? (r.club_naam+' (#'+(r.club_nr||'')+')') : '';
  state.club = r.club_nr ? {'Nr.':r.club_nr,'Naam':r.club_naam,'Vestigingsgemeente':r.gemeente||''} : null;
}

function collect(){
  var begroot=parseEur($('#f-begroot').value);
  var finPct=parsePct($('#f-fin-pct').value);
  var finEur=parseEur($('#f-fin-eur').value);
  var eigPct=parsePct($('#f-eigen-pct').value);
  var eigEur=parseEur($('#f-eigen-eur').value);
  if(begroot>0){
    if(finPct!=null && (!finEur||finEur===0)) finEur=begroot*(finPct/100);
    if(finEur&&finEur>0 && (finPct==null||finPct===0)) finPct=100*finEur/begroot;
    if(eigPct!=null && (!eigEur||eigEur===0)) eigEur=begroot*(eigPct/100);
    if(eigEur&&eigEur>0 && (eigPct==null||eigPct===0)) eigPct=100*eigEur/begroot;
  }
  var club=state.club||{};
  return {
    club_nr: club['Nr.']?String(club['Nr.']):null, club_naam: club['Naam']||null, gemeente: club['Vestigingsgemeente']||null,
    titel: club['Naam']||null, type: $('#f-type').value, status: $('#f-status').value, eigenaar: $('#f-eigenaar').value, notities: $('#f-note').value||null,
    start_datum: isoFromNL($('#f-start').value), eind_datum: isoFromNL($('#f-eind').value), laatste_update: null,
    begroot_eur: begroot||0, financiering_type: $('#f-fin-type').value, financiering_pct: finPct, financiering_eur: finEur||0, eigen_pct: eigPct, eigen_eur: eigEur||0
  };
}

function bindFinance(){
  var lock=false;
  function fromPct(){ if(lock) return; lock=true;
    var b=parseEur($('#f-begroot').value), p=parsePct($('#f-fin-pct').value), ep=parsePct($('#f-eigen-pct').value);
    if(b>0 && p!=null) $('#f-fin-eur').value=fmtEur(b*(p/100));
    if(b>0 && ep!=null) $('#f-eigen-eur').value=fmtEur(b*(ep/100));
    lock=false; }
  function fromEur(){ if(lock) return; lock=true;
    var b=parseEur($('#f-begroot').value), e=parseEur($('#f-fin-eur').value), ee=parseEur($('#f-eigen-eur').value);
    if(b>0 && e) $('#f-fin-pct').value=String((100*e/b).toFixed(2)).replace('.',',');
    if(b>0 && ee) $('#f-eigen-pct').value=String((100*ee/b).toFixed(2)).replace('.',',');
    lock=false; }
  ['f-begroot','f-fin-pct','f-eigen-pct'].forEach(function(id){ on($('#'+id),'input',fromPct); });
  ['f-fin-eur','f-eigen-eur'].forEach(function(id){ on($('#'+id),'input',fromEur); });
}

function bindClubSearch(){
  var dd=$('#club-dd');
  function search(q){
    if(!q||q.length<2){ dd.innerHTML=''; return; }
    var expr='Naam.ilike.%'+q+'%, "Subsoort organisatie".ilike.%'+q+'%';
    supabase.from('clubs').select('"Nr.", Naam, "Vestigingsgemeente"').or(expr).limit(10)
      .then(function({data,error}){
        if(error){ console.error(error); dd.innerHTML='<div class="mute...">Zoeken mislukt</div>'; return; }
        if(!data||!data.length){ dd.innerHTML='<div class="mute...">Geen resultaten</div>'; return; }
        dd.innerHTML=data.map(function(r){
          return '<div class="opt" data-nr="'+r['Nr.']+'" data-naam="'+(r['Naam']||'')+'" data-gem="'+(r['Vestigingsgemeente']||'')+'">'
               + (r['Naam']||'')+' <small>#'+r['Nr.']+'</small></div>';
        }).join('');
      });
  }
  on($('#club-q'),'input',function(e){ search(e.target.value.trim()); });
  on(dd,'click',function(e){
    var opt=e.target.closest('.opt'); if(!opt) return;
    state.club={'Nr.':opt.getAttribute('data-nr'),'Naam':opt.getAttribute('data-naam'),'Vestigingsgemeente':opt.getAttribute('data-gem')};
    $('#club-q').value=opt.getAttribute('data-naam')+' (#'+opt.getAttribute('data-nr')+')'; dd.innerHTML='';
  });
}

export default function mount(app){
  app.innerHTML = view();
  var modal=bindModal(); bindFinance(); bindClubSearch();
  on($('#f-status-filter'),'change',function(){ renderList(); });
  on($('#btn-new'),'click',function(){ state.editId=null; state.club=null; $('#dlg-title').textContent='Nieuw traject'; ['f-start','f-eind','f-begroot','f-fin-pct','f-fin-eur','f-eigen-pct','f-eigen-eur','f-note','club-q'].forEach(function(id){ var el=$('#'+id); if(el) el.value=''; }); $('#f-begroot').value='0,00'; $('#f-fin-eur').value='0,00'; $('#f-eigen-eur').value='0,00'; modal.open(); });
  document.addEventListener('click',function(e){ var b=e.target.closest('.btn-edit'); var c=e.target.closest('.t-card'); var id=(b&&b.getAttribute('data-id'))||(c&&c.getAttribute('data-id')); if(!id) return; var r=(state.list||[]).find(function(x){return String(x.id)===String(id);}); if(r){ state.editId=r.id; prefill(r); modal.open(); } });
  on($('#dlg-save'),'click',function(){ var payload=collect(); var req= state.editId ? supabase.from('trajecten').update(payload).eq('id', state.editId) : supabase.from('trajecten').insert(payload); req.then(function({error}){ if(error){ console.error(error); alert('Opslaan mislukt: '+(error.message||error)); return; } modal.close(); loadList(); }); });
  loadList();
}
