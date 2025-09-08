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

function loadPage(page){
  app.innerHTML = '<div class="panel"><p><strong>' + page + '</strong> wordt geladen…</p></div>';
  var cacheBust = '17';
  var modUrl = './pages/' + page + '.js?v=' + cacheBust;

  // extra logging om precies te zien wat er misgaat
  console.log('[loader] import', modUrl);
  import(modUrl)
    .then(function (module) {
      console.log('[loader] imported ok:', modUrl, module);
      if (module && typeof module.default === 'function'){
        var res = module.default(app);
        if (res && typeof res.then === 'function'){ return res; }
        return Promise.resolve();
      } else {
        throw new Error('Module ' + page + ' heeft geen default export');
      }
    })
    .catch(function (err) {
      console.error('Module load error:', err);
      var tried = page + '.js?v=' + cacheBust;
      app.innerHTML = '<div class="alert err">Module <strong>' + page + '</strong> niet gevonden of met fout geladen.<br><small>Probeerde: ' + tried + '</small></div>';
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
