
// pages/import.js – CSV Importer (scoped UI) – v1
import { supabase } from '../supabaseClient.js';

(function(){
  function $(sel, root){ return (root||document).querySelector(sel); }
  function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);}); }
  function chunk(arr, size){ var out=[], i=0; for(i=0;i<arr.length;i+=size){ out.push(arr.slice(i,i+size)); } return out; }

  var CSS = [
    '.sf-import .panel{background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06);padding:14px;margin-bottom:12px}',
    '.sf-import .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
    '.sf-import .input{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font:inherit}',
    '.sf-import .btn{border:0;border-radius:12px;padding:10px 14px;cursor:pointer;background:#e8eef8}',
    '.sf-import .btn.primary{background:#0ea5e9;color:#fff}',
    '.sf-import table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}',
    '.sf-import th, .sf-import td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:13px}',
    '.sf-import th{background:#f8fafc;color:#475569}',
    '.sf-import .alert{padding:10px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc}',
    '.sf-import .alert.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}',
    '.sf-import .ok{color:#065f46}',
    '.sf-import .progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}',
    '.sf-import .bar{height:100%;background:#0ea5e9;width:0%}',
    '.sf-import .muted{color:#64748b}',
    '.sf-import .map-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.sf-import .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:12px}'
  ].join('');

  function injectStylesOnce(){
    if (document.getElementById('importer-scope')) return;
    var s=document.createElement('style'); s.id='importer-scope'; s.textContent=CSS; document.head.appendChild(s);
  }

  function detectDelimiter(sample){
    var counts = { ',':0, ';':0, '\t':0 };
    var i=0, ch='', inQ=false;
    for(i=0;i<sample.length;i++){
      ch=sample[i];
      if(ch === '"'){ inQ = !inQ; continue; }
      if(!inQ && (ch===','||ch===';'||ch==='\t')) counts[ch]++;
    }
    var best = ',', max = counts[','];
    if (counts[';'] > max){ best=';'; max=counts[';']; }
    if (counts['\t'] > max){ best='\t'; max=counts['\t']; }
    return best;
  }

  function parseCSV(text){
    var delim = detectDelimiter(text.slice(0, 10000));
    var rows = [];
    var i=0, ch='', cell='', row=[], inQ=false;
    function pushCell(){ row.push(cell); cell=''; }
    function pushRow(){ rows.push(row); row=[]; }

    for(i=0;i<text.length;i++){
      ch = text[i];
      if (ch === '"'){
        if (inQ && text[i+1] === '"'){ cell += '"'; i++; }
        else { inQ = !inQ; }
      } else if (!inQ && (ch === '\n' || ch === '\r')){
        if (ch === '\r' && text[i+1] === '\n') i++;
        pushCell(); pushRow();
      } else if (!inQ && ch === delim){
        pushCell();
      } else {
        cell += ch;
      }
    }
    if (cell.length>0 || row.length>0){ pushCell(); pushRow(); }
    if (rows.length>0 && rows[rows.length-1].every(function(x){ return String(x||'').trim()===''; })){ rows.pop(); }
    if (rows.length===0) return { headers:[], rows:[] };

    var headers = rows.shift().map(function(h){ return String(h||'').trim(); });
    var objects = rows.map(function(r){
      var o={}, j=0;
      for(j=0;j<headers.length;j++){ o[headers[j] || ('col'+j)] = r[j]; }
      return o;
    });
    return { headers: headers, rows: objects, delimiter: delim };
  }

  function view(){
    return (
      '<div class="sf-import">'+
        '<div class="panel">'+
          '<h3 style="margin:0 0 8px">CSV import (Supabase upsert)</h3>'+
          '<div class="row">'+
            '<input id="file" type="file" class="input" accept=".csv,text/csv" />'+
            '<input id="table" class="input" style="min-width:220px" placeholder="Tabelnaam (bv. trajecten)" />'+
            '<input id="key" class="input" style="min-width:220px" placeholder="Match kolom (bv. id of club_nr)" />'+
            '<button id="btn-parse" class="btn">Voorbeeld laden</button>'+
          '</div>'+
          '<p class="muted" style="margin:8px 0 0">CSV met headerregel. Delimiter wordt automatisch gedetecteerd (komma/semicolon/tab).</p>'+
        '</div>'+
        '<div id="preview" class="panel" style="display:none"></div>'+
        '<div id="mapping" class="panel" style="display:none"></div>'+
        '<div id="run" class="panel" style="display:none"></div>'+
      '</div>'
    );
  }

  function renderPreview(root, csv){
    var el = $('#preview', root);
    var rows = csv.rows.slice(0, 10);
    var head = '<tr>'+ csv.headers.map(function(h){ return '<th>'+escapeHtml(h)+'</th>'; }).join('') +'</tr>';
    var body = rows.map(function(r){
      return '<tr>'+ csv.headers.map(function(h){ return '<td>'+escapeHtml(r[h]||'')+'</td>'; }).join('') +'</tr>';
    }).join('');
    el.innerHTML = '<h4 style="margin:0 0 6px">Voorbeeld</h4>' +
      '<div class="muted" style="margin-bottom:8px">Detecteerde delimiter: <span class="pill">'+ (csv.delimiter===';'?'semicolon (;)':(csv.delimiter==='\\t'?'tab (\\t)':'comma (,)' )) +'</span></div>'+
      '<div style="overflow:auto"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
    el.style.display = 'block';
  }

  function renderMapping(root, table, key, csv, dbCols){
    var el = $('#mapping', root);
    var mapItems = dbCols.map(function(c){
      return '<div class="row"><label style="min-width:200px">'+escapeHtml(c)+'</label><select class="input map" data-col="'+escapeHtml(c)+'"><option value="">-- kies uit CSV --</option>'+
              csv.headers.map(function(h){ return '<option'+(h===c?' selected':'')+'>'+escapeHtml(h)+'</option>'; }).join('')+
             '</select></div>';
    }).join('');
    el.innerHTML = '<h4 style="margin:0 0 6px">Koppeling</h4>' +
      '<div class="muted" style="margin-bottom:8px">Tabel: <strong>'+escapeHtml(table)+'</strong> • Match kolom: <strong>'+escapeHtml(key)+'</strong></div>' +
      '<div class="map-grid">'+ mapItems +'</div>'+
      '<div style="margin-top:10px" class="row">'+
        '<button id="btn-dry" class="btn">Controle (dry-run)</button>'+
        '<button id="btn-run" class="btn primary">Upsert uitvoeren</button>'+
      '</div>';
    el.style.display = 'block';
  }

  function renderRun(root){
    var el = $('#run', root);
    el.innerHTML = '<h4 style="margin:0 0 6px">Uitvoering</h4>' +
      '<div class="progress"><div class="bar" id="bar"></div></div>'+
      '<p id="log" class="muted" style="margin:8px 0 0">Nog niet gestart.</p>';
    el.style.display = 'block';
  }

  function getDbColumns(table){
    return supabase.from(table).select('*').limit(1).then(function(res){
      if (res && res.error){ return []; }
      var row = res && res.data && res.data[0] ? res.data[0] : null;
      if (!row) return [];
      var cols=[], k;
      for (k in row){ if (Object.prototype.hasOwnProperty.call(row,k)) cols.push(k); }
      return cols;
    }).catch(function(){ return []; });
  }

  function pickMappedRecords(csv, mapping){
    var out = [];
    var i=0, r, obj, k, val;
    for(i=0;i<csv.rows.length;i++){
      r = csv.rows[i];
      obj = {};
      for (k in mapping){
        if (!mapping[k]) continue;
        val = r[mapping[k]];
        if (val==='' || typeof val==='undefined') val = null;
        obj[k] = val;
      }
      out.push(obj);
    }
    return out;
  }

  function validate(records, key){
    var missingKey = [];
    var i=0, seen={}, dupes=[];
    for(i=0;i<records.length;i++){
      var id = records[i][key];
      if (!id){ missingKey.push(i+2); continue; }
      if (seen[id]) dupes.push(id); else seen[id]=1;
    }
    return { missingKey: missingKey, dupes: dupes };
  }

  function upsertBatch(table, payload, key, onProgress){
    var parts = chunk(payload, 500);
    var done = 0, failed = 0, all = payload.length;
    function step(i){
      if (i >= parts.length) return Promise.resolve({ done: done, failed: failed });
      var part = parts[i];
      return supabase.from(table).upsert(part, { onConflict: key })
        .then(function(res){
          if (res && res.error){ failed += part.length; } else { done += part.length; }
          if (onProgress) onProgress(Math.round(100*(done+failed)/all));
          return step(i+1);
        })
        .catch(function(){
          failed += part.length;
          if (onProgress) onProgress(Math.round(100*(done+failed)/all));
          return step(i+1);
        });
    }
    return step(0);
  }

  function mount(root){
    injectStylesOnce();
    root.innerHTML = view();

    var state = { csv:null, table:'', key:'id', dbCols:[] };

    on($('#btn-parse', root), 'click', function(){
      var f = $('#file', root).files && $('#file', root).files[0];
      state.table = $('#table', root).value.trim();
      state.key = ($('#key', root).value.trim() || 'id');
      if (!f){ alert('Kies een CSV-bestand.'); return; }
      if (!state.table){ alert('Vul een tabelnaam in.'); return; }

      var reader = new FileReader();
      reader.onload = function(ev){
        try{
          var text = ev.target.result;
          state.csv = (function parseCSV(text){
            var delim = (function detectDelimiter(sample){
              var counts = { ',':0, ';':0, '\\t':0 };
              var i=0, ch='', inQ=false;
              for(i=0;i<sample.length;i++){
                ch=sample[i];
                if(ch === '\"'){ inQ = !inQ; continue; }
                if(!inQ && (ch===','||ch===';'||ch==='\\t')) counts[ch]++;
              }
              var best = ',', max = counts[','];
              if (counts[';'] > max){ best=';'; max=counts[';']; }
              if (counts['\\t'] > max){ best='\\t'; max=counts['\\t']; }
              return best;
            })(text.slice(0, 10000));
            var rows = []; var i=0, ch='', cell='', row=[], inQ=false;
            function pushCell(){ row.push(cell); cell=''; }
            function pushRow(){ rows.push(row); row=[]; }
            for(i=0;i<text.length;i++){
              ch = text[i];
              if (ch === '\"'){
                if (inQ && text[i+1] === '\"'){ cell += '\"'; i++; }
                else { inQ = !inQ; }
              } else if (!inQ && (ch === '\\n' || ch === '\\r')){
                if (ch === '\\r' && text[i+1] === '\\n') i++;
                pushCell(); pushRow();
              } else if (!inQ && ch === delim){
                pushCell();
              } else {
                cell += ch;
              }
            }
            if (cell.length>0 || row.length>0){ pushCell(); pushRow(); }
            if (rows.length>0 && rows[rows.length-1].every(function(x){ return String(x||'').trim()===''; })){ rows.pop(); }
            if (rows.length===0) return { headers:[], rows:[], delimiter:delim };
            var headers = rows.shift().map(function(h){ return String(h||'').trim(); });
            var objects = rows.map(function(r){
              var o={}, j=0;
              for(j=0;j<headers.length;j++){ o[headers[j] || ('col'+j)] = r[j]; }
              return o;
            });
            return { headers: headers, rows: objects, delimiter: delim };
          })(text);
          (function renderPreview(root, csv){
            var el = document.querySelector('#preview');
            var rows = csv.rows.slice(0, 10);
            var head = '<tr>'+ csv.headers.map(function(h){ return '<th>'+escapeHtml(h)+'</th>'; }).join('') +'</tr>';
            var body = rows.map(function(r){
              return '<tr>'+ csv.headers.map(function(h){ return '<td>'+escapeHtml(r[h]||'')+'</td>'; }).join('') +'</tr>';
            }).join('');
            el.innerHTML = '<h4 style="margin:0 0 6px">Voorbeeld</h4>' +
              '<div class="muted" style="margin-bottom:8px">Detecteerde delimiter: <span class="pill">'+ (csv.delimiter===';'?'semicolon (;)':(csv.delimiter==='\\t'?'tab (\\t)':'comma (,)' )) +'</span></div>'+
              '<div style="overflow:auto"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>';
            el.style.display = 'block';
          })(root, state.csv);
          getDbColumns(state.table).then(function(cols){
            state.dbCols = cols && cols.length ? cols : state.csv.headers;
            (function renderMapping(root, table, key, csv, dbCols){
              var el = document.querySelector('#mapping');
              var mapItems = dbCols.map(function(c){
                return '<div class="row"><label style="min-width:200px">'+escapeHtml(c)+'</label><select class="input map" data-col="'+escapeHtml(c)+'"><option value="">-- kies uit CSV --</option>'+
                        csv.headers.map(function(h){ return '<option'+(h===c?' selected':'')+'>'+escapeHtml(h)+'</option>'; }).join('')+
                       '</select></div>';
              }).join('');
              el.innerHTML = '<h4 style="margin:0 0 6px">Koppeling</h4>' +
                '<div class="muted" style="margin-bottom:8px">Tabel: <strong>'+escapeHtml(table)+'</strong> • Match kolom: <strong>'+escapeHtml(key)+'</strong></div>' +
                '<div class="map-grid">'+ mapItems +'</div>'+
                '<div style="margin-top:10px" class="row">'+
                  '<button id="btn-dry" class="btn">Controle (dry-run)</button>'+
                  '<button id="btn-run" class="btn primary">Upsert uitvoeren</button>'+
                '</div>';
              el.style.display = 'block';
            })(root, state.table, state.key, state.csv, state.dbCols);
            (function renderRun(root){
              var el = document.querySelector('#run');
              el.innerHTML = '<h4 style="margin:0 0 6px">Uitvoering</h4>' +
                '<div class="progress"><div class="bar" id="bar"></div></div>'+
                '<p id="log" class="muted" style="margin:8px 0 0">Nog niet gestart.</p>';
              el.style.display = 'block';
            })(root);
          });
        } catch(e){
          console.error(e);
          alert('CSV kon niet worden gelezen. Controleer het bestand.');
        }
      };
      reader.readAsText(f, 'utf-8');
    });

    on($('#mapping', root), 'click', function(e){
      var id = e.target && e.target.id;
      if (id !== 'btn-dry' && id !== 'btn-run') return;

      var mapping = {};
      var selects = root.querySelectorAll('#mapping select.map');
      var i=0, col, chosen;
      for(i=0;i<selects.length;i++){
        col = selects[i].getAttribute('data-col');
        chosen = selects[i].value || '';
        mapping[col] = chosen;
      }
      if (!mapping[state.key]){
        alert('Kies een CSV-kolom voor de match kolom "' + state.key + '".');
        return;
      }

      function pickMappedRecords(csv, mapping){
        var out = []; var i=0, r, obj, k, val;
        for(i=0;i<csv.rows.length;i++){
          r = csv.rows[i]; obj = {};
          for (k in mapping){
            if (!mapping[k]) continue;
            val = r[mapping[k]];
            if (val==='' || typeof val==='undefined') val = null;
            obj[k] = val;
          }
          out.push(obj);
        }
        return out;
      }
      function validate(records, key){
        var missingKey = []; var i=0, seen={}, dupes=[];
        for(i=0;i<records.length;i++){
          var id = records[i][key];
          if (!id){ missingKey.push(i+2); continue; }
          if (seen[id]) dupes.push(id); else seen[id]=1;
        }
        return { missingKey: missingKey, dupes: dupes };
      }
      var records = pickMappedRecords(state.csv, mapping);
      var check = validate(records, state.key);
      var log = $('#log', root), bar = $('#bar', root);

      if (id === 'btn-dry'){
        var msg = 'Records: '+ records.length + ' • ontbrekende "'+state.key+'": '+ check.missingKey.length;
        if (check.dupes.length) msg += ' • dubbele keys (eerste 5): ' + check.dupes.slice(0,5).join(', ');
        bar.style.width = '0%';
        log.textContent = '[DRY-RUN] ' + msg;
        return;
      }

      if (check.missingKey.length){
        if (!confirm('Er ontbreken '+check.missingKey.length+' waardes voor "'+state.key+'". Toch doorgaan?')) return;
      }

      function upsertBatch(table, payload, key, onProgress){
        var parts = (function(arr, size){ var out=[], i=0; for(i=0;i<arr.length;i+=size){ out.push(arr.slice(i,i+size)); } return out; })(payload, 500);
        var done = 0, failed = 0, all = payload.length;
        function step(i){
          if (i >= parts.length) return Promise.resolve({ done: done, failed: failed });
          var part = parts[i];
          return supabase.from(table).upsert(part, { onConflict: key })
            .then(function(res){
              if (res && res.error){ failed += part.length; } else { done += part.length; }
              if (onProgress) onProgress(Math.round(100*(done+failed)/all));
              return step(i+1);
            })
            .catch(function(){
              failed += part.length;
              if (onProgress) onProgress(Math.round(100*(done+failed)/all));
              return step(i+1);
            });
        }
        return step(0);
      }

      $('#run', root).scrollIntoView({ behavior:'smooth', block:'start' });
      log.textContent = 'Bezig met upsert…';
      upsertBatch($('#table',root).value.trim(), records, state.key, function(pct){
        bar.style.width = pct + '%';
      }).then(function(res){
        bar.style.width = '100%';
        log.innerHTML = '<span class="ok">Klaar.</span> Gelukt: '+ res.done +' • Mislukt: '+ res.failed +'.';
      });
    });
  }

  export default function(app){
    mount(app);
  }
})();
