function loadPage(page) {
  const app = document.getElementById('app');
  app.innerHTML = `<p>${page} wordt geladen...</p>`;
  import(`./pages/${page}.js`).then(module => {
    app.innerHTML = '';
    module.default(app);
  }).catch(err => {
    app.innerHTML = `<p>Module ${page} niet gevonden.</p>`;
  });
}