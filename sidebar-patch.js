// sidebar-patch.js
// Doel: automatisch "Trajecten" en "Data-import" toevoegen aan je sidebar zonder je HTML handmatig te editen.

(function(){
  const PAGES = [
    { key: 'trajecten', label: 'Trajecten' },
    { key: 'data-import', label: 'Data-import' }
  ];

  function findSidebar(){
    // Probeer een paar veelvoorkomende containers
    const candidates = [
      document.querySelector('[data-sidebar]'),
      document.querySelector('#sidebar'),
      document.querySelector('.sidebar'),
      document.querySelector('.left'),
      document.querySelector('nav'),
    ].filter(Boolean);
    return candidates[0] || document.body;
  }

  function createLink(page){
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.textContent = page.label;
    a.href = '#'; // voorkom pagina refresh
    a.dataset.page = page.key;
    a.style.display = 'block';
    a.style.cursor = 'pointer';
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (typeof window.loadPage === 'function'){
        window.loadPage(page.key);
      } else if (typeof window.navigate === 'function'){
        window.navigate(page.key);
      } else {
        // fallback: zet hash en vertrouw op hash-router
        location.hash = page.key;
        window.dispatchEvent(new CustomEvent('navigate', { detail: page.key }));
      }
      setActive(page.key);
    });
    return a;
  }

  function setActive(key){
    document.querySelectorAll('.nav-link').forEach(el => {
      if (el.dataset.page === key) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  function alreadyExists(container, key){
    return !!container.querySelector(`.nav-link[data-page="${key}"]`);
  }

  function init(){
    const sidebar = findSidebar();
    // Maak eventueel een lijstcontainer
    let list = sidebar.querySelector('.nav-list');
    if (!list){
      list = document.createElement('div');
      list.className = 'nav-list';
      sidebar.appendChild(list);
    }
    PAGES.forEach(p => {
      if (!alreadyExists(list, p.key)){
        list.appendChild(createLink(p));
      }
    });
    // Active state op basis van hash
    const hk = location.hash.replace('#','');
    if (hk) setActive(hk);
  }

  // Wacht tot DOM klaar is
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
