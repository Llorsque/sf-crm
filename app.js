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
    const modUrl = `./pages/${page}.js?v=13`;
    const module = await import(modUrl);
    await module.default(app);
  } catch (err) {
    console.error('Module load error:', err);
    app.innerHTML = `<div class="alert">Module <strong>${page}</strong> niet gevonden of met fout geladen.<br><small>Probeerde: <code>${page}.js?v=13</code></small></div>`;
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


// === Enhancements: CRM detail formatting & traject quicklinks ===

// Utility: prettify label (remove leading underscores, capitalize first letter)
function sfPrettyLabel(txt) {
  if (!txt || typeof txt !== 'string') return txt;
  let s = txt.replace(/^_+/, '');
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Post-process a detail container (expects .kv grid)
function sfFixDetailLabels(root) {
  if (!root) return;
  // Fix labels
  root.querySelectorAll('.kv strong').forEach(el => {
    el.textContent = sfPrettyLabel(el.textContent.trim());
  });

  // Traject rendering: show "Naam Status" only and make clickable
  const KNOWN_STATUSES = ['Intake','Analyse','Planning','Uitvoering','Afgerond','On hold','Opstart','Voorbereiding','Gestopt','In afwachting'];
  root.querySelectorAll('.kv div').forEach(row => {
    const label = row.querySelector('strong')?.textContent?.trim();
    if (label === 'Trajecten' || label === 'Traject' ) {
      const valEl = Array.from(row.childNodes).find(n => n.nodeType === Node.TEXT_NODE || (n.nodeType===1 && !n.matches('strong')));
      // If value element is a text node, wrap it in span to replace content safely
      let container;
      if (valEl && valEl.nodeType === Node.TEXT_NODE) {
        container = document.createElement('span');
        container.textContent = valEl.textContent;
        row.appendChild(container);
        row.removeChild(valEl);
      } else if (valEl && valEl.nodeType === 1) {
        container = valEl;
      }
      if (container) {
        const raw = container.textContent.trim();
        // Try to extract name and status from messy combined string
        let name = raw;
        let status = '';
        const statusRegex = new RegExp('(' + KNOWN_STATUSES.join('|') + ')(?![\\w-])');
        const m = raw.match(statusRegex);
        if (m) {
          status = m[1];
          name = raw.slice(0, m.index).trim();
        } else {
          // Fallback: cut at first digit or euro sign
          const idx = raw.search(/[0-9€]/);
          if (idx > 0) name = raw.slice(0, idx).trim();
        }
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'link-traject';
        link.dataset.name = name;
        link.textContent = status ? `${name} ${status}` : name;
        container.replaceChildren(link);
      }
    }
  });
}

// Navigate to trajecten module with an optional filter by name
function sfOpenTrajectByName(name) {
  try {
    sessionStorage.setItem('traject_filter_name', name || '');
  } catch(e) {}
  const navLink = document.querySelector('#nav [data-page="trajecten"]');
  if (navLink) {
    navLink.click();
    // Try to apply filter shortly after navigation
    setTimeout(() => {
      const setFilter = () => {
        const input = document.querySelector('[data-traject-filter], input[name="traject-search"], .trajecten input[type="search"]');
        if (input) {
          const v = sessionStorage.getItem('traject_filter_name') || name || '';
          input.value = v;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      };
      let tries = 0;
      const id = setInterval(() => {
        tries++;
        if (setFilter() || tries > 30) clearInterval(id);
      }, 100);
    }, 50);
  }
}

// Global click handler for traject links
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.link-traject');
  if (!a) return;
  e.preventDefault();
  const name = a.dataset.name || a.textContent.trim();
  sfOpenTrajectByName(name);
});

// Observe DOM to detect detail modals/panels (elements with class .kv inside a modal or sidebar)
const sfObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches('.kv, .modal .kv, #modal .kv, .offscreen .kv')) {
        sfFixDetailLabels(node.closest('.modal') || node.closest('#modal') || node);
      } else {
        const kv = node.querySelector?.('.kv');
        if (kv) sfFixDetailLabels(node);
      }
    }
  }
});

// Start observing once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sfObserver.observe(document.body, { childList: true, subtree: true }));
} else {
  sfObserver.observe(document.body, { childList: true, subtree: true });
}
