import { supabase } from '../supabaseClient.js';
import Papa from 'https://esm.sh/papaparse@5.4.1';

export default function mount(app){
  app.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <div>
          <h2 style="margin:0">Data-import (clubs)</h2>
          <div class="muted">Koppel extra gegevens aan clubs via <code>club_nr</code>.</div>
        </div>
        <div style="display:flex; gap:8px">
          <button id="btn-help" class="btn-accent">ℹ️ Uitleg</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="grid">
        <section>
          <h3>1) CSV uploaden</h3>
          <div id="drop" class="drop">
            <input id="file" type="file" accept=".csv" hidden />
            <p><strong>Sleep je CSV hierheen</strong> of <button id="pick" class="btn-accent" type="button">Kies bestand</button></p>
            <p class="muted">Verplicht: kolom <code>club_nr</code>. Optioneel: <code>profit</code> (true/false), <code>leden</code> (int), <code>contributie_avg</code> (decimal).</p>
          </div>
        </section>
        <section>
          <h3>2) Instellingen</h3>
          <div class="muted" style="margin-bottom:8px">Kies je importmethode:</div>
          <label class="row"><input type="radio" name="mode" value="upsert" checked/> Optie B — <strong>Direct upsert</strong> naar <code>club_extra</code></label>
          <label class="row"><input type="radio" name="mode" value="staging"/> Optie C — <strong>Staging + Merge</strong> (veilig, herhaalbaar)</label>
          <div class="muted" style="margin-top:8px">Batchgrootte</div>
          <input id="batch" class="filter-input" value="500" style="max-width:140px"/>
        </section>
      </div>
    </div>

    <div class="card">
      <h3>3) Preview & mapping</h3>
      <div id="map" class="map"></div>
      <div id="preview" class="table-wrap"></div>
    </div>

    <div class="card">
      <div style="display:flex; gap:8px">
        <button id="btn-import" class="btn-accent" disabled>⬆️ Importeren</button>
        <button id="btn-clear" class="btn-secondary" disabled>Leeg scherm</button>
      </div>
      <div id="log" class="log"></div>
      <div id="progress" class="progress" style="display:none">
        <div id="bar" class="bar" style="width:0%"></div>
      </div>
    </div>
  `;

  injectStyles();
  const $ = s => app.querySelector(s);
  const state = { rows: [], mapping: {}, mode: 'upsert' };

  // UI events
  $('#btn-help').onclick = showHelp;
  const fileInput = $('#file');
  $('#pick').onclick = () => fileInput.click();
  const drop = $('#drop');
  ;['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault(); drop.classList.add('drag');}));
  ;['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault(); drop.classList.remove('drag');}));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); });
  fileInput.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) handleFile(f); });

  app.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener('change', ()=> state.mode = r.value );
  });

  $('#btn-import').onclick = doImport;
  $('#btn-clear').onclick = clearAll;

  function showHelp(){
    alert([
      'CSV met minimaal kolom "club_nr".',
      'Optionele kolommen: profit (true/false), leden (int), contributie_avg (decimal).',
      'Optie B: direct upserten naar club_extra (snel).',
      'Optie C: upload naar staging, daarna "merge" via serverfunctie (veilig & schoon).'
    ].join('\n'));
  }

  async function handleFile(file){
    const text = await file.text();
    const { data, errors, meta } = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (errors?.length){ console.error(errors); alert('CSV bevat parse-fouten. Controleer je bestand.'); return; }
    state.rows = data;
    autoMap(meta.fields || []);
    renderMapping(meta.fields || []);
    renderPreview(state.rows);
    $('#btn-import').disabled = false;
    $('#btn-clear').disabled = false;
  }

  function autoMap(headers){
    const rev = {}; // mapping van header -> target
    const norm = s => String(s||'').toLowerCase().replace(/\s+|\./g,'_');
    headers.forEach(h => {
      const k = norm(h);
      if (k === 'club_nr' || k === 'nr') rev[h] = 'club_nr';
      else if (k === 'profit') rev[h] = 'profit';
      else if (k === 'leden') rev[h] = 'leden';
      else if (k === 'contributie_avg' || k === 'gem_contributie' || k === 'contributie') rev[h] = 'contributie_avg';
    });
    // omzetten naar target -> header (state.mapping)
    state.mapping = Object.fromEntries(Object.entries(rev).map(([h,t]) => [t,h]));
  }

  function renderMapping(headers){
    const choices = ['','club_nr','profit','leden','contributie_avg'];
    const opts = (selected) => choices.map(f => `<option value="${f}" ${(f===selected)?'selected':''}>${f||'(negeren)'}</option>`).join('');
    const rev = Object.fromEntries(Object.entries(state.mapping).map(([t,h])=>[h,t]));

    const html = headers.map(h => {
      const selected = rev[h] || '';
      return `
        <div class="map-row">
          <div class="h">${escapeHtml(h)}</div>
          <select class="filter-input sel" data-h="${escapeHtml(h)}">
            ${opts(selected)}
          </select>
        </div>`;
    }).join('');

    $('#map').innerHTML = `
      <div class="muted">Koppeling CSV-kolommen → doeltabel velden (leeg = overslaan)</div>
      <div class="map-grid">${html}</div>
    `;

    app.querySelectorAll('.sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const h = sel.dataset.h;
        const target = sel.value || null;
        // verwijder bestaande mapping naar dit target
        for (const [t, hdr] of Object.entries(state.mapping)){
          if (t !== 'club_nr' && hdr === h) delete state.mapping[t];
        }
        if (target) state.mapping[target] = h;
      });
    });
  }

  function renderPreview(rows){
    const n = Math.min(10, rows.length);
    const slice = rows.slice(0, n);
    if (!slice.length){ $('#preview').innerHTML = '<div class="muted">Geen rijen gevonden in CSV.</div>'; return; }
    const headers = Object.keys(slice[0]);
    const th = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const tr = slice.map(r => `<tr>${headers.map(h => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`).join('');
    $('#preview').innerHTML = `<div class="muted" style="margin-bottom:8px">Preview (eerste ${n} rijen)</div><div class="table"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }

  async function doImport(){
    const rows = state.rows;
    const m = state.mapping;
    if (!m.club_nr){ alert('Mapping vereist: club_nr is verplicht.'); return; }
    const batchSize = parseInt($('#batch').value || '500', 10);

    const normRows = rows.map(r => {
      const x = {};
      if (m.club_nr) x.club_nr = String(r[m.club_nr] ?? '').trim();
      if (m.profit)  x.profit = toBool(r[m.profit]);
      if (m.leden)   x.leden = toInt(r[m.leden]);
      if (m.contributie_avg) x.contributie_avg = toNum(r[m.contributie_avg]);
      return x;
    }).filter(x => x.club_nr);

    if (!normRows.length){ alert('Na mapping bleven geen geldige rijen over.'); return; }

    $('#progress').style.display = 'block';
    const bar = $('#bar');
    const mode = state.mode;
    let processed = 0

    try {
      if (mode === 'upsert'){
        for (let i = 0; i < normRows.length; i += batchSize){
          const chunk = normRows.slice(i, i+batchSize);
          const { error } = await supabase.from('club_extra').upsert(chunk, { onConflict: 'club_nr' });
          if (error) throw error;
          processed += chunk.length;
          bar.style.width = `${Math.round(100*processed/normRows.length)}%`;
        }
        log(`Upsert voltooid. Rijen: ${normRows.length}`);
      } else {
        // Staging eerst leegmaken
        await supabase.from('club_extra_staging').delete().neq('club_nr', '');
        // Insert chunks in staging
        for (let i = 0; i < normRows.length; i += batchSize){
          const chunk = normRows.slice(i, i+batchSize);
          const { error } = await supabase.from('club_extra_staging').insert(chunk);
          if (error) throw error;
          processed += chunk.length;
          bar.style.width = `${Math.round(100*processed/normRows.length)}%`;
        }
        // Merge op server
        const { data, error } = await supabase.rpc('import_merge_club_extra');
        if (error) throw error;
        const ins = data?.[0]?.inserted ?? 0;
        const upd = data?.[0]?.updated ?? 0;
        log(`Merge voltooid. Inserted: ${ins}, Updated: ${upd}`);
      }
      alert('Import gereed.');
    } catch (e){
      console.error(e);
      alert('Import fout. Check console/log.');
      log(`<span class="err">${escapeHtml(e.message || e)}</span>`);
    } finally {
      $('#progress').style.display = 'none';
      bar.style.width = '0%';
    }
  }

  function clearAll(){
    state.rows = [];
    state.mapping = {};
    $('#map').innerHTML = '';
    $('#preview').innerHTML = '';
    $('#btn-import').disabled = true;
    $('#btn-clear').disabled = true;
    $('#progress').style.display = 'none';
    $('#bar').style.width = '0%';
    $('#log').innerHTML = '';
  }

  // Helpers
  function toBool(v){ return /^true|1|yes|ja$/i.test(String(v||'').trim()); }
  function toInt(v){ const n = parseInt(String(v||'').replace(/\D+/g,''), 10); return Number.isFinite(n) ? n : null; }
  function toNum(v){ const n = parseFloat(String(v||'').replace(/[\s€\.]/g,'').replace(',','.')); return Number.isFinite(n) ? n : null; }
  function log(html){ $('#log').innerHTML += `<div>${html}</div>`; }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function injectStyles(){
    const css = `
      .drop{border:2px dashed #e7eef7; border-radius:14px; padding:18px; text-align:center; background:#fbfdff;}
      .drop.drag{background:#f1fbfb;}
      .row{display:flex; align-items:center; gap:8px; margin-bottom:6px;}
      .map-grid{display:grid; grid-template-columns:1fr 220px; gap:8px; margin-top:8px;}
      .map-row{display:contents;}
      .map-row .h{padding:8px 0;}
      .table-wrap{overflow:auto; max-height:360px; border:1px solid #eef0f6; border-radius:12px;}
      .table table{width:100%; border-collapse:collapse; font-size:.95rem;}
      .table th,.table td{padding:8px 10px; border-bottom:1px solid #f2f4f9; text-align:left;}
      .log{margin-top:10px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:.9rem;}
      .log .err{color:#c2410c; font-weight:700;}
      .progress{height:8px; background:#eef2f8; border-radius:999px; overflow:hidden; margin-top:10px;}
      .progress .bar{height:100%; background:#52E8E8; transition:width .2s;}
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }
}
