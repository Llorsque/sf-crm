
/**
 * traj-hotfix.js
 * Runtime enhancements for Trajecten:
 * - Enable club change in edit modal (reuses #club-q / #club-dd if present; otherwise injects picker).
 * - Add a robust "Verwijderen" button that deletes via Supabase and refreshes UI.
 * - Safe: only runs on the Trajecten page; no rebuild of your existing module.
 */
(function(){
  if (!window.supabase) {
    console.warn('[traj-hotfix] supabase client not found; aborting');
    return;
  }

  function euroToNumber(s){
    if (!s) return null;
    const v = parseFloat(String(s).replace(/[€\s\.]/g,'').replace(',', '.'));
    return isNaN(v) ? null : v;
  }
  function pctToNumber(s){
    if (s == null || s === '') return null;
    const v = parseFloat(String(s).replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  // Attach once per modal open
  let wiredForThisOpen = false;

  // Observe modal open/close
  const obs = new MutationObserver(() => {
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('modal-overlay');
    if (!modal || !overlay) return;
    const open = modal.classList.contains('open') && overlay.classList.contains('show');
    if (open && !wiredForThisOpen) {
      wiredForThisOpen = true;
      try { enhanceEditModal(); } catch(e){ console.error('[traj-hotfix] enhance failed', e); }
    }
    if (!open) { wiredForThisOpen = false; }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  async function searchClubs(term){
    if (!term) return [];
    const { data, error } = await supabase
      .from('clubs')
      .select('club_nr, vereniging, plaats, gemeente')
      .ilike('vereniging', `%${term}%`)
      .limit(12);
    if (error) { console.error('[traj-hotfix] club search error', error); return []; }
    return data || [];
  }

  function ensureDeleteButton(){
    const footer = document.querySelector('#modal .modal-foot, .modal-foot');
    if (!footer) return null;
    let btn = document.getElementById('modal-delete');
    if (!btn){
      btn = document.createElement('button');
      btn.id = 'modal-delete';
      btn.className = 'btn btn-danger';
      btn.type = 'button';
      btn.textContent = 'Verwijderen';
      footer.insertBefore(btn, document.getElementById('modal-save') || footer.firstChild);
    }
    return btn;
  }

  function selectedItemFromContext(){
    // Try to guess the item shown in modal from the last clicked card with data-id
    const last = document.querySelector('article.traj-card[data-id].is-editing') || document.querySelector('article.traj-card[data-id].active');
    let id = last ? last.getAttribute('data-id') : null;
    // fallback: parse title if contains id
    if (!id){
      const title = document.querySelector('#modal .modal-head h3')?.textContent || '';
      const m = title.match(/#(\d+)/);
      if (m) id = m[1];
    }
    // As a last resort, read from a possible hidden input
    return id;
  }

  function enhanceEditModal(){
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('modal-overlay');
    if (!modal || !overlay) return;

    // Enable club input
    const clubInput = document.getElementById('club-q');
    if (clubInput){
      clubInput.removeAttribute('disabled');
      clubInput.placeholder ||= 'Zoek vereniging...';
    }
    let dd = document.getElementById('club-dd');
    if (!dd){
      dd = document.createElement('div');
      dd.id = 'club-dd';
      dd.className = 'dd';
      clubInput && clubInput.parentNode.appendChild(dd);
    }

    // Keep chosen club on the modal dataset
    modal.dataset.selectedClub = ''; // reset each open

    // Wire search behavior
    let searchDebounce;
    if (clubInput){
      clubInput.addEventListener('input', function(){
        clearTimeout(searchDebounce);
        const term = this.value.trim();
        if (term.length < 2){ dd && (dd.innerHTML = ''); return; }
        searchDebounce = setTimeout(async () => {
          const list = await searchClubs(term);
          dd.innerHTML = list.map(c => `
            <div class="dd-item" data-club='${JSON.stringify(c).replace(/'/g, "&apos;")}'>
              ${c.vereniging} <span class="muted">(#${c.club_nr})</span> · <span class="muted">${c.plaats||''}</span>
            </div>`).join('');
          dd.querySelectorAll('.dd-item').forEach(el=>{
            el.addEventListener('click', () => {
              const club = JSON.parse(el.getAttribute('data-club').replace(/&apos;/g, "'"));
              modal.dataset.selectedClub = JSON.stringify(club);
              if (clubInput) clubInput.value = `${club.vereniging} (#${club.club_nr})`;
              dd.innerHTML = '';
            });
          });
        }, 220);
      });
    }

    // Intercept SAVE for updates (edit context): capture & stop original save
    const saveBtn = document.getElementById('modal-save');
    if (saveBtn){
      const handler = async function(ev){
        // Guard: only hijack when not in "Nieuw traject" (we detect existing id by last selected card)
        const id = selectedItemFromContext();
        if (!id) return; // allow original handler for new inserts
        ev.stopImmediatePropagation();
        ev.preventDefault();

        // Build payload from fields present
        const payload = {
          titel: document.getElementById('f-type')?.value || 'Traject',
          type: document.getElementById('f-type')?.value || null,
          status: document.getElementById('f-stage-new')?.value || 'Intake',
          start_datum: document.getElementById('f-start')?.value || null,
          eind_datum: document.getElementById('f-eind')?.value || null,
          eigenaar: document.getElementById('f-eigenaar')?.value || null,
          begeleider: document.getElementById('f-begeleider')?.value || null,
          notities: document.getElementById('f-note')?.value || null,
          begroot_eur: euroToNumber(document.getElementById('f-begroot')?.value),
          financiering_type: document.getElementById('f-fin-type')?.value || null,
          financiering_pct: pctToNumber(document.getElementById('f-fin-pct')?.value),
          financiering_eur: euroToNumber(document.getElementById('f-fin-eur')?.value),
          eigen_pct: pctToNumber(document.getElementById('f-eigen-pct')?.value),
          eigen_eur: euroToNumber(document.getElementById('f-eigen-eur')?.value),
          laatste_update: document.getElementById('f-last')?.value || null
        };

        // Optional club change
        if (modal.dataset.selectedClub){
          try {
            const c = JSON.parse(modal.dataset.selectedClub);
            // add likely schema fields
            payload.club_nr = c.club_nr;
            payload.club_naam = c.vereniging;
            payload.plaats = c.plaats || null;
            payload.gemeente = c.gemeente || null;
          } catch(e){ console.warn('[traj-hotfix] cannot parse selectedClub', e); }
        }

        // Fetch current item to know allowed keys (schema-safe)
        let item = null;
        try {
          const { data } = await supabase.from('trajecten').select('*').eq('id', id).limit(1).maybeSingle();
          item = data || null;
        } catch(e){ console.warn('[traj-hotfix] fetch current item failed', e); }

        if (item){
          const allowed = new Set(Object.keys(item));
          for (const k of Object.keys(payload)){
            if (!allowed.has(k)) delete payload[k];
          }
        }

        const { error } = await supabase.from('trajecten').update(payload).eq('id', id);
        if (error){
          console.error('[traj-hotfix] update failed', error);
          alert('Opslaan mislukt: ' + (error.message || error));
          return;
        }

        // Close and refresh
        try { document.getElementById('modal-close')?.click(); } catch(_){}
        try { document.getElementById('modal-cancel')?.click(); } catch(_){}
        // Prefer clicking "Ververs" if present; else reload page
        const refreshBtn = document.getElementById('btn-refresh') || document.querySelector('[data-action="refresh"]');
        if (refreshBtn) refreshBtn.click(); else location.reload();
        window.sfSetStatus && window.sfSetStatus('Traject bijgewerkt', 'ok');
      };
      // capture phase to preempt original handler
      saveBtn.addEventListener('click', handler, true);
    }

    // DELETE button
    const del = ensureDeleteButton();
    if (del){
      del.addEventListener('click', async function(){
        const id = selectedItemFromContext();
        if (!id) { alert('Geen traject-id gevonden.'); return; }
        if (!confirm('Weet je zeker dat je dit traject wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
        const { error } = await supabase.from('trajecten').delete().eq('id', id);
        if (error){ console.error('[traj-hotfix] delete failed', error); alert('Verwijderen mislukt: ' + (error.message||error)); return; }
        try { document.getElementById('modal-close')?.click(); } catch(_){}
        const refreshBtn = document.getElementById('btn-refresh') || document.querySelector('[data-action="refresh"]');
        if (refreshBtn) refreshBtn.click(); else location.reload();
        window.sfSetStatus && window.sfSetStatus('Traject verwijderd', 'ok');
      }, { once: true });
    }
  }

  // Tag clicked cards to help identify context
  document.addEventListener('click', function(ev){
    const card = ev.target.closest('article.traj-card[data-id]');
    if (!card) return;
    document.querySelectorAll('article.traj-card.is-editing').forEach(el => el.classList.remove('is-editing'));
    card.classList.add('is-editing');
  });

})();
