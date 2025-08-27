import { supabase } from '../supabaseClient.js'

export default async function(app) {
  app.innerHTML = "<h2>CRM Overzicht</h2><div id='results'>Laden...</div>";
  const { data, error } = await supabase.from('clubs').select('*').limit(10);
  if (error) {
    app.innerHTML = `<p>Fout: ${error.message}</p>`;
    return;
  }
  console.log("Supabase data:", data);
  app.innerHTML = "<h2>CRM Overzicht</h2>" + data.map(c => `<div class='club-card'>${c['Naam'] || 'Onbekend'}</div>`).join('');
}
