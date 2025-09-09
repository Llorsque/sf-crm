// v21 robust loader (no async/await), catches runtime errors too
const VER = '21';
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const statusEl = document.getElementById('sb-status');

nav.addEventListener('click', function (e) {
  const link = e.target.closest('a[data-page]');
  if (!link) return;
  var links = nav.querySelectorAll('a');
  for (var i=0;i<links.length;i++){ links[i].classList.toggle('active', links[i]===link); }
  loadPage(link.dataset.page);
});
document.getElementById('btn-refresh').addEventListener('click', function () {
  var activeEl = nav.querySelector('a.active');
  var active = activeEl ? activeEl.dataset.page : 'crm';
  loadPage(active);
});

function importFallback(page){
  const base = './pages/' + page + '.js';
  const urls = [base + '?v=' + VER, base + '?cb=' + Date.now(), base];
  let last = null;
  function next(i){
    if (i >= urls.length) return Promise.reject(last || new Error('All imports failed'));
    const url = urls[i];
    console.log('[loader] try import', url);
    return import(url).catch(err => { console.error('[loader] import failed', url, err); last = err; return next(i+1); });
  }
  return next(0);
}
function preflight(page){
  const url = './pages/' + page + '.js?chk=' + VER;
  return fetch(url, { cache: 'no-store' }).then(function(res){
    console.log('[loader] preflight', url, res.status);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return true;
  });
}

function loadPage(page){
  app.innerHTML = '<div class="panel"><p><strong>' + page + '</strong> wordt geladen…</p></div>';
  preflight(page)
    .catch(function(e){ console.warn('[loader] preflight failed:', e && e.message ? e.message : e); })
    .then(function(){ return importFallback(page); })
    .then(function(module){
      console.log('[loader] imported ok:', page, module);
      if (!module || typeof module.default !== 'function') throw new Error('Geen default export');
      try {
        const res = module.default(app);
        if (res && typeof res.then === 'function'){ return res; }
        return Promise.resolve();
      } catch (e){
        console.error('[loader] runtime error in', page, e);
        app.innerHTML = '<div class="alert err">Module <strong>' + page + '</strong> gaf een runtime-fout.<br><small>Zie console voor details.</small></div>';
      }
    })
    .catch(function(err){
      console.error('Module load error:', err);
      app.innerHTML = '<div class="alert err">Module <strong>' + page + '</strong> niet gevonden of met fout geladen.<br><small>Probeerde: ' + page + '.js?v=' + VER + '</small></div>';
    });
}

// Supabase status indicator
import { supabase } from './supabaseClient.js';
function checkSupabase(){
  return supabase
    .from('clubs')
    .select('"Nr."', { count: 'exact', head: true })
    .limit(1)
    .then(function ({ error }) {
      if (error) throw error;
      statusEl.textContent = 'verbonden';
      statusEl.className = 'ok';
    })
    .catch(function (e) {
      statusEl.textContent = 'fout';
      statusEl.className = 'err';
      console.error('Supabase check failed:', e);
    });
}
checkSupabase();
loadPage('crm');
