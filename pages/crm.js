import { supabase } from '../supabaseClient.js'

export default async function(app) {
  app.innerHTML = "<h2>CRM Overzicht</h2><p>Data laden...</p>"

  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, Naam, "Subsoort organisatie", Vestigingsgemeente, "Aantal leden"')
    .limit(50)

  if (error) {
    app.innerHTML = `<p>Fout bij laden: ${error.message}</p>`
    return
  }

  let html = `<div class="card"><h3>Clubs (${clubs.length})</h3></div>`
  clubs.forEach(club => {
    html += `<div class="card">
      <h3>${club.Naam}</h3>
      <p><strong>Sport:</strong> ${club['Subsoort organisatie'] || '-'}<br/>
      <strong>Gemeente:</strong> ${club['Vestigingsgemeente'] || '-'}<br/>
      <strong>Leden:</strong> ${club['Aantal leden'] || '-'}</p>
    </div>`
  })
  app.innerHTML = html
}
