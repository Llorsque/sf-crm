const app = document.getElementById('app');
const nav = document.getElementById('nav');
const statusEl = document.getElementById('sb-status');

nav.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-page]');
  if (!link) return;
  [...nav.querySelectorAll('a')].forEach(a => a.classList.toggle('active', a===link));
  loadPage(link.dataset.page);
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  const active = nav.querySelector('a.active')?.dataset.page || 'crm';
  loadPage(active);
});

async function loadPage(page){
  // show loading
  app.innerHTML = `<div class="panel"><p><strong>${page}</strong> wordt geladen…</p></div>`;
  try {
    const cacheBust = '16';
    const modUrl = `./pages/${page}.js?v=${cacheBust}`;
    const module = await import(modUrl);
    if (typeof module.default === 'function'){
      await module.default(app);
    } else {
      throw new Error(`Module ${page} heeft geen default export`);
    }
  } catch (err) {
    console.error('Module load error:', err);
    const tried = `${page}.js?v=16`;
    app.innerHTML = `<div class="alert err">Module <strong>${page}</strong> niet gevonden of met fout geladen.<br><small>Probeerde: ${tried}</small></div>`;
  }
}

// Supabase status indicator (optional)
import { supabase } from './supabaseClient.js';

async function checkSupabase(){
  try {
    const { error } = await supabase
      .from('clubs')
      .select('"Nr."', { count: 'exact', head: true })
      .limit(1);
    if (error) throw error;
    statusEl.textContent = 'verbonden';
    statusEl.className = 'ok';
  } catch (e) {
    statusEl.textContent = 'fout';
    statusEl.className = 'err';
    console.error('Supabase check failed:', e);
  }
}

checkSupabase();
loadPage('crm');
