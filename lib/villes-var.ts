// Communes Île-de-France + départements limitrophes desservis par Aprime fluides
// (Oise, Eure, Eure-et-Loir, Seine-Maritime, Aisne). Format : nom affiché + code postal.
// NB : nom de variable conservé (VILLES_VAR) pour compat des imports existants.
export interface VilleVar { nom: string; cp: string }

export const VILLES_VAR: VilleVar[] = [
  // Paris (75)
  { nom: "Paris", cp: "75000" },
  // Hauts-de-Seine (92)
  { nom: "Nanterre", cp: "92000" },
  { nom: "Boulogne-Billancourt", cp: "92100" },
  { nom: "Asnières-sur-Seine", cp: "92600" },
  { nom: "Colombes", cp: "92700" },
  { nom: "Courbevoie", cp: "92400" },
  { nom: "Rueil-Malmaison", cp: "92500" },
  { nom: "Antony", cp: "92160" },
  { nom: "Clamart", cp: "92140" },
  { nom: "Issy-les-Moulineaux", cp: "92130" },
  { nom: "Levallois-Perret", cp: "92300" },
  { nom: "Neuilly-sur-Seine", cp: "92200" },
  { nom: "Clichy", cp: "92110" },
  { nom: "Montrouge", cp: "92120" },
  { nom: "Gennevilliers", cp: "92230" },
  { nom: "Suresnes", cp: "92150" },
  { nom: "Bagneux", cp: "92220" },
  // Seine-Saint-Denis (93)
  { nom: "Saint-Denis", cp: "93200" },
  { nom: "Montreuil", cp: "93100" },
  { nom: "Aubervilliers", cp: "93300" },
  { nom: "Aulnay-sous-Bois", cp: "93600" },
  { nom: "Drancy", cp: "93700" },
  { nom: "Noisy-le-Grand", cp: "93160" },
  { nom: "Bobigny", cp: "93000" },
  { nom: "Bondy", cp: "93140" },
  { nom: "Épinay-sur-Seine", cp: "93800" },
  { nom: "Pantin", cp: "93500" },
  { nom: "Sevran", cp: "93270" },
  { nom: "Rosny-sous-Bois", cp: "93110" },
  { nom: "Le Blanc-Mesnil", cp: "93150" },
  { nom: "La Courneuve", cp: "93120" },
  { nom: "Bagnolet", cp: "93170" },
  // Val-de-Marne (94)
  { nom: "Créteil", cp: "94000" },
  { nom: "Vitry-sur-Seine", cp: "94400" },
  { nom: "Champigny-sur-Marne", cp: "94500" },
  { nom: "Saint-Maur-des-Fossés", cp: "94100" },
  { nom: "Vincennes", cp: "94300" },
  { nom: "Ivry-sur-Seine", cp: "94200" },
  { nom: "Maisons-Alfort", cp: "94700" },
  { nom: "Villejuif", cp: "94800" },
  { nom: "Choisy-le-Roi", cp: "94600" },
  { nom: "Alfortville", cp: "94140" },
  { nom: "Fontenay-sous-Bois", cp: "94120" },
  { nom: "Le Perreux-sur-Marne", cp: "94170" },
  { nom: "Cachan", cp: "94230" },
  { nom: "Charenton-le-Pont", cp: "94220" },
  // Val-d'Oise (95)
  { nom: "Bezons", cp: "95870" },
  { nom: "Argenteuil", cp: "95100" },
  { nom: "Cergy", cp: "95000" },
  { nom: "Pontoise", cp: "95300" },
  { nom: "Sarcelles", cp: "95200" },
  { nom: "Garges-lès-Gonesse", cp: "95140" },
  { nom: "Franconville", cp: "95130" },
  { nom: "Ermont", cp: "95120" },
  { nom: "Goussainville", cp: "95190" },
  { nom: "Gonesse", cp: "95500" },
  { nom: "Sannois", cp: "95110" },
  { nom: "Eaubonne", cp: "95600" },
  { nom: "Herblay", cp: "95220" },
  { nom: "Taverny", cp: "95150" },
  { nom: "Beauchamp", cp: "95250" },
  { nom: "Saint-Gratien", cp: "95210" },
  { nom: "Enghien-les-Bains", cp: "95880" },
  // Yvelines (78)
  { nom: "Versailles", cp: "78000" },
  { nom: "Sartrouville", cp: "78500" },
  { nom: "Mantes-la-Jolie", cp: "78200" },
  { nom: "Saint-Germain-en-Laye", cp: "78100" },
  { nom: "Poissy", cp: "78300" },
  { nom: "Conflans-Sainte-Honorine", cp: "78700" },
  { nom: "Les Mureaux", cp: "78130" },
  { nom: "Chatou", cp: "78400" },
  { nom: "Houilles", cp: "78800" },
  { nom: "Trappes", cp: "78190" },
  { nom: "Montigny-le-Bretonneux", cp: "78180" },
  { nom: "Plaisir", cp: "78370" },
  { nom: "Maisons-Laffitte", cp: "78600" },
  { nom: "Rambouillet", cp: "78120" },
  // Essonne (91)
  { nom: "Évry-Courcouronnes", cp: "91000" },
  { nom: "Corbeil-Essonnes", cp: "91100" },
  { nom: "Massy", cp: "91300" },
  { nom: "Savigny-sur-Orge", cp: "91600" },
  { nom: "Sainte-Geneviève-des-Bois", cp: "91700" },
  { nom: "Athis-Mons", cp: "91200" },
  { nom: "Palaiseau", cp: "91120" },
  { nom: "Viry-Châtillon", cp: "91170" },
  { nom: "Draveil", cp: "91210" },
  { nom: "Yerres", cp: "91330" },
  { nom: "Brunoy", cp: "91800" },
  { nom: "Montgeron", cp: "91230" },
  { nom: "Étampes", cp: "91150" },
  { nom: "Les Ulis", cp: "91940" },
  // Seine-et-Marne (77)
  { nom: "Meaux", cp: "77100" },
  { nom: "Chelles", cp: "77500" },
  { nom: "Melun", cp: "77000" },
  { nom: "Pontault-Combault", cp: "77340" },
  { nom: "Savigny-le-Temple", cp: "77176" },
  { nom: "Champs-sur-Marne", cp: "77420" },
  { nom: "Villeparisis", cp: "77270" },
  { nom: "Torcy", cp: "77200" },
  { nom: "Lagny-sur-Marne", cp: "77400" },
  { nom: "Bussy-Saint-Georges", cp: "77600" },
  { nom: "Provins", cp: "77160" },
  { nom: "Fontainebleau", cp: "77300" },
  { nom: "Coulommiers", cp: "77120" },
  // Oise (60)
  { nom: "Beauvais", cp: "60000" },
  { nom: "Compiègne", cp: "60200" },
  { nom: "Creil", cp: "60100" },
  { nom: "Senlis", cp: "60300" },
  { nom: "Chantilly", cp: "60500" },
  { nom: "Nogent-sur-Oise", cp: "60180" },
  { nom: "Méru", cp: "60110" },
  { nom: "Clermont", cp: "60600" },
  { nom: "Pont-Sainte-Maxence", cp: "60700" },
  // Eure (27)
  { nom: "Évreux", cp: "27000" },
  { nom: "Vernon", cp: "27200" },
  { nom: "Louviers", cp: "27400" },
  { nom: "Val-de-Reuil", cp: "27100" },
  { nom: "Gisors", cp: "27140" },
  { nom: "Pont-Audemer", cp: "27500" },
  { nom: "Les Andelys", cp: "27700" },
  { nom: "Bernay", cp: "27300" },
  // Eure-et-Loir (28)
  { nom: "Chartres", cp: "28000" },
  { nom: "Dreux", cp: "28100" },
  { nom: "Lucé", cp: "28110" },
  { nom: "Châteaudun", cp: "28200" },
  { nom: "Nogent-le-Rotrou", cp: "28400" },
  { nom: "Vernouillet", cp: "28500" },
  { nom: "Mainvilliers", cp: "28300" },
  // Seine-Maritime (76)
  { nom: "Rouen", cp: "76000" },
  { nom: "Le Havre", cp: "76600" },
  { nom: "Dieppe", cp: "76200" },
  { nom: "Sotteville-lès-Rouen", cp: "76300" },
  { nom: "Saint-Étienne-du-Rouvray", cp: "76800" },
  { nom: "Le Grand-Quevilly", cp: "76120" },
  { nom: "Mont-Saint-Aignan", cp: "76130" },
  { nom: "Elbeuf", cp: "76500" },
  { nom: "Fécamp", cp: "76400" },
  { nom: "Yvetot", cp: "76190" },
  // Aisne (02)
  { nom: "Saint-Quentin", cp: "02100" },
  { nom: "Soissons", cp: "02200" },
  { nom: "Laon", cp: "02000" },
  { nom: "Château-Thierry", cp: "02400" },
  { nom: "Tergnier", cp: "02700" },
  { nom: "Hirson", cp: "02500" },
  { nom: "Chauny", cp: "02300" },
]

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function searchVilles(query: string, limit = 8): VilleVar[] {
  const q = normalize(query)
  if (!q) return []
  return VILLES_VAR
    .filter(v => normalize(v.nom).includes(q))
    .sort((a, b) => {
      // priorité : commence par la query
      const an = normalize(a.nom), bn = normalize(b.nom)
      const aStarts = an.startsWith(q)
      const bStarts = bn.startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.nom.localeCompare(b.nom, 'fr')
    })
    .slice(0, limit)
}

export function findVilleByName(name: string): VilleVar | undefined {
  const q = normalize(name)
  return VILLES_VAR.find(v => normalize(v.nom) === q)
}
