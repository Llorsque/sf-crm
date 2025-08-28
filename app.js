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

async function loadPage(page) {
  app.innerHTML = `<p class="muted">Module <strong>${page}</strong> wordt geladen…</p>`;
  try {
    const module = await import(`./pages/${page}.js?v=5`);
    await module.default(app);
  } catch (err) {
    console.error('Module load error:', err);
    app.innerHTML = `<div class="alert">Module <strong>${page}</strong> niet gevonden.</div>`;
  }
}

import { supabase } from './supabaseClient.js';
async function checkSupabase() {
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
