async function loadPage(page) {
  const app = document.getElementById('app');
  app.innerHTML = `<p>${page} wordt geladen...</p>`;
  try {
    const module = await import(`./pages/${page}.js`);
    app.innerHTML = '';
    module.default(app);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p>Module ${page} niet gevonden.</p>`;
  }
}
