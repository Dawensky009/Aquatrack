/**
 * Donnees de demonstration.
 *
 * Objectif : qu'au tout premier lancement, chaque ecran ait quelque chose de
 * credible a montrer — y compris les fonctionnalites qui ne se revelent que
 * dans la duree (evolution du prix d'appro, ecart entre les deux marges,
 * alerte de hausse).
 *
 * Choix de calibrage, et pourquoi :
 *
 *   - 60 jours. A ~90 gallons/jour, un camion de 1 200 gallons dure environ
 *     deux semaines. Il faut donc au moins deux mois pour voir plusieurs
 *     reapprovisionnements et un graphique de prix en escalier qui raconte
 *     quelque chose.
 *   - 5 camions pour 59 jours de vente : le stock reste positif du debut a
 *     la fin. Un stock negatif serait immediatement visible et faux.
 *   - Prix d'achat 7,00 -> 7,25 -> 7,50 -> 7,50 -> 8,00. La derniere hausse
 *     declenche l'alerte du tableau de bord et fait diverger « marge
 *     actuelle » et « marge du mois », qui est precisement ce que ces deux
 *     indicateurs doivent montrer.
 *   - Aucun jour manquant : l'app ne doit pas accueillir l'utilisateur par un
 *     rappel de cloture sur des donnees fictives.
 */

import { cleJour } from './format.js'
import { enregistrerJournee, enregistrerDepense, amorcerCategories } from './db.js'

/**
 * Generateur pseudo-aleatoire deterministe (mulberry32).
 * Volontairement pas Math.random : la demo doit etre identique a chaque
 * reinitialisation, sinon un chiffre constate a l'ecran ne serait plus
 * reproductible d'une session a l'autre.
 */
function alea(graine) {
  let a = graine
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const JOURS = 60
const PRIX_VENTE = 25
const CAPACITE = 1200

/**
 * Camions : { ilYaNJours, prix par gallon }
 *
 * Six livraisons pour 59 jours de vente : a ~95 gallons/jour on ecoule
 * environ 5 600 gallons, donc 7 200 recus laissent une quinzaine de jours
 * d'avance. Un stock qui frole zero des l'ouverture declencherait l'alerte
 * de rupture sur des donnees fictives.
 *
 * La derniere livraison est la seule a renviserer : c'est elle qui rend
 * visibles l'alerte de hausse et l'ecart entre marge actuelle et marge
 * du mois.
 */
const CAMIONS = [
  { jours: 60, prixGallon: 7.0 },
  { jours: 50, prixGallon: 7.25 },
  { jours: 40, prixGallon: 7.5 },
  { jours: 30, prixGallon: 7.5 },
  { jours: 20, prixGallon: 7.5 },
  { jours: 10, prixGallon: 8.0 },
]

/** Achats de materiel : { ilYaNJours, montant } */
const MATERIEL = [
  { jours: 50, montant: 1500 },
  { jours: 30, montant: 800 },
  { jours: 8, montant: 2200 },
]

function dateDecalee(joursAvant, reference = new Date()) {
  const d = new Date(reference)
  d.setDate(d.getDate() - joursAvant)
  d.setHours(9, 0, 0, 0)
  return d
}

export async function genererDemo(reference = new Date()) {
  // Les identifiants sont tires au hasard a l'amorcage : il faut les recevoir
  // de la base, ils ne sont plus devinables depuis le module.
  const categories = await amorcerCategories()

  const catAppro = categories.find((c) => c.suit_gallons)
  const catMateriel = categories.find((c) => !c.suit_gallons)
  const rnd = alea(20260720)

  for (const c of CAMIONS) {
    const d = dateDecalee(c.jours, reference)
    await enregistrerDepense({
      occurred_at: d.toISOString(),
      category_id: catAppro.id,
      quantity: CAPACITE,
      total: Math.round(CAPACITE * c.prixGallon),
      entry_mode: 'forfait',
      payment_method: 'cash',
      note: '',
    })
  }

  for (const m of MATERIEL) {
    const d = dateDecalee(m.jours, reference)
    await enregistrerDepense({
      occurred_at: d.toISOString(),
      category_id: catMateriel.id,
      quantity: null,
      total: m.montant,
      entry_mode: null,
      payment_method: rnd() < 0.3 ? 'moncash' : 'cash',
      note: '',
    })
  }

  // Ventes : de la veille du premier camion jusqu'a hier.
  // Aujourd'hui est volontairement laisse ouvert — la journee n'est pas finie,
  // et c'est la premiere action que l'utilisateur aura a faire.
  for (let i = JOURS - 1; i >= 1; i--) {
    const d = dateDecalee(i, reference)
    const jourSemaine = d.getDay()
    const weekend = jourSemaine === 0 || jourSemaine === 6

    // Les gallons sont entiers : on achete de l'eau par gallon, pas par litre.
    const base = weekend ? 105 : 78
    const gallons = Math.round(base + rnd() * (weekend ? 30 : 22))
    const montant = gallons * PRIX_VENTE

    // MonCash reste minoritaire au comptoir : environ un jour sur trois,
    // et sur une fraction du chiffre.
    const moncash = rnd() < 0.35 ? Math.round((montant * (0.15 + rnd() * 0.25)) / 25) * 25 : 0

    await enregistrerJournee({
      date: cleJour(d),
      montant,
      moncash,
      gallons,
      gallons_source: 'estime',
      releve_compteur: null,
      prix_reference: PRIX_VENTE,
      note: '',
    })
  }
}
