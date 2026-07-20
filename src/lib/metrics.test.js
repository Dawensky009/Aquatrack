import { describe, it, expect } from 'vitest'
import * as M from './metrics.js'
import { formatHTG, formatPrix, formatGallons, cleJour, lireNombre, formatDateLongue, formatDateCourte } from './format.js'

/* --------------------------------------------------------------------------
   Fabriques
   -------------------------------------------------------------------------- */

const CAT_APPRO = { id: 'c-appro', nom: "Reapprovisionnement d'eau", color: '#222026', unit: 'gallon', suit_gallons: true, position: 0, deleted: false }
const CAT_MAT = { id: 'c-mat', nom: 'Achat materiel', color: '#2672DD', unit: 'montant', suit_gallons: false, position: 1, deleted: false }

const journee = (date, montant, { gallons, prix = 25, moncash = 0, source = 'estime', deleted = false } = {}) => ({
  id: `j-${date}`,
  date,
  montant,
  moncash,
  gallons: gallons ?? montant / prix,
  gallons_source: source,
  releve_compteur: null,
  prix_reference: prix,
  note: '',
  updated_at: `${date}T20:00:00.000Z`,
  deleted,
})

const reappro = (date, gallons, total, { deleted = false } = {}) => ({
  id: `d-${date}`,
  occurred_at: `${date}T09:00:00.000Z`,
  recorded_at: `${date}T09:00:00.000Z`,
  category_id: CAT_APPRO.id,
  quantity: gallons,
  unit_price: total / gallons,
  total,
  entry_mode: 'forfait',
  payment_method: 'cash',
  note: '',
  updated_at: `${date}T09:00:00.000Z`,
  deleted,
})

const materiel = (date, total) => ({
  id: `m-${date}`,
  occurred_at: `${date}T09:00:00.000Z`,
  recorded_at: `${date}T09:00:00.000Z`,
  category_id: CAT_MAT.id,
  quantity: null,
  unit_price: null,
  total,
  entry_mode: null,
  payment_method: 'cash',
  note: '',
  updated_at: `${date}T09:00:00.000Z`,
  deleted: false,
})

const etat = ({ journees = [], depenses = [], prix = 25 } = {}) => ({
  journees,
  depenses,
  categories: [CAT_APPRO, CAT_MAT],
  reglages: { prix_vente_gallon: prix, capacite_camion: 1200, compteur_actif: false },
})

const P = M.creerPeriode('2026-07-01', '2026-07-31')

/* --------------------------------------------------------------------------
   Le piege numero un : la ponderation du cout moyen
   -------------------------------------------------------------------------- */

describe('coutMoyenPondere', () => {
  it('pondere par les gallons, pas par les prix', () => {
    // 1 200 gal a 7,00 = 8 400 HTG   |   600 gal a 8,00 = 4 800 HTG
    // total 13 200 HTG pour 1 800 gallons  ->  7,333... HTG/gallon
    // La moyenne simple des prix donnerait 7,50 : c'est l'erreur a ne pas faire.
    const e = etat({
      depenses: [reappro('2026-07-05', 1200, 8400), reappro('2026-07-20', 600, 4800)],
    })
    expect(M.coutMoyenPondere(e, P)).toBeCloseTo(7.3333, 4)
    expect(M.coutMoyenPondere(e, P)).not.toBeCloseTo(7.5, 4)
  })

  it('renvoie null sans aucun reapprovisionnement', () => {
    expect(M.coutMoyenPondere(etat(), P)).toBeNull()
  })

  it('ignore les lignes supprimees', () => {
    const e = etat({
      depenses: [reappro('2026-07-05', 1200, 8400), reappro('2026-07-20', 600, 9000, { deleted: true })],
    })
    expect(M.coutMoyenPondere(e, P)).toBeCloseTo(7, 4)
  })
})

/* --------------------------------------------------------------------------
   Le double mode de saisie doit produire une ligne identique
   -------------------------------------------------------------------------- */

describe('modes de saisie du reapprovisionnement', () => {
  it('forfait camion et prix au gallon donnent le meme cout unitaire', () => {
    const forfait = reappro('2026-07-05', 1200, 9000) // 1 200 gallons pour 9 000 HTG
    const unitaire = { ...reappro('2026-07-05', 1200, 1200 * 7.5), entry_mode: 'unitaire' }
    expect(forfait.total).toBe(unitaire.total)
    expect(forfait.unit_price).toBeCloseTo(unitaire.unit_price, 10)
    expect(forfait.unit_price).toBeCloseTo(7.5, 10)
  })
})

/* --------------------------------------------------------------------------
   Marges
   -------------------------------------------------------------------------- */

describe('marges', () => {
  const e = etat({
    journees: [journee('2026-07-10', 1000), journee('2026-07-11', 2000)],
    depenses: [reappro('2026-07-01', 1200, 8400), reappro('2026-07-15', 1200, 9600)],
  })

  it('la marge actuelle utilise le DERNIER cout d appro', () => {
    const m = M.margeActuelle(e)
    expect(m.cout).toBeCloseTo(8, 4) // 9 600 / 1 200
    expect(m.prix).toBe(25)
    expect(m.marge).toBeCloseTo(17, 4)
  })

  it('la marge de periode utilise le cout moyen pondere', () => {
    const m = M.margePeriode(e, P)
    expect(m.cout).toBeCloseTo(7.5, 4) // (8 400 + 9 600) / 2 400
    expect(m.marge).toBeCloseTo(17.5, 4)
  })

  it('les deux divergent apres une hausse', () => {
    expect(M.margeActuelle(e).marge).not.toBeCloseTo(M.margePeriode(e, P).marge, 4)
  })

  it('les deux coincident si tous les achats sont au meme prix', () => {
    const stable = etat({
      journees: [journee('2026-07-10', 1000)],
      depenses: [reappro('2026-07-01', 1200, 9000), reappro('2026-07-15', 600, 4500)],
    })
    expect(M.margeActuelle(stable).marge).toBeCloseTo(M.margePeriode(stable, P).marge, 6)
  })

  it('renvoie null sans reapprovisionnement', () => {
    expect(M.margeActuelle(etat({ journees: [journee('2026-07-10', 1000)] }))).toBeNull()
    expect(M.margePeriode(etat({ journees: [journee('2026-07-10', 1000)] }), P)).toBeNull()
  })
})

/* --------------------------------------------------------------------------
   La boucle metier decrite au plan, de bout en bout
   -------------------------------------------------------------------------- */

describe('boucle metier complete', () => {
  it('1 200 gallons a 9 000 HTG, journee a 1 000 HTG -> 40 gallons, 700 HTG de benefice', () => {
    const e = etat({
      journees: [journee('2026-07-10', 1000)],
      depenses: [reappro('2026-07-01', 1200, 9000)],
    })
    expect(M.gallonsVendus(e, P)).toBeCloseTo(40, 6)
    expect(M.dernierCoutGallon(e)).toBeCloseTo(7.5, 6)

    const cout = 40 * M.dernierCoutGallon(e)
    expect(cout).toBeCloseTo(300, 6)
    expect(1000 - cout).toBeCloseTo(700, 6)
  })
})

/* --------------------------------------------------------------------------
   Ou part votre argent
   -------------------------------------------------------------------------- */

describe('ouPartArgent', () => {
  it('les parts somment exactement au total encaisse', () => {
    const e = etat({
      journees: [journee('2026-07-10', 20000)],
      depenses: [reappro('2026-07-01', 1200, 9000), materiel('2026-07-03', 1500)],
    })
    const r = M.ouPartArgent(e, P)
    const total = r.parts.reduce((t, p) => t + p.montant, 0) + r.benefice
    expect(total).toBeCloseTo(r.total, 6)
    expect(r.total).toBe(20000)
    expect(r.benefice).toBe(9500)
    expect(r.deficitaire).toBe(false)
  })

  it('signale le cas deficitaire au lieu de produire une part negative', () => {
    const e = etat({
      journees: [journee('2026-07-10', 2000)],
      depenses: [reappro('2026-07-01', 1200, 9000)],
    })
    const r = M.ouPartArgent(e, P)
    expect(r.deficitaire).toBe(true)
    expect(r.benefice).toBeLessThan(0)
    expect(r.parts.every((p) => p.montant > 0)).toBe(true)
  })

  it('renvoie null sans aucune activite', () => {
    expect(M.ouPartArgent(etat(), P)).toBeNull()
  })
})

/* --------------------------------------------------------------------------
   Stock
   -------------------------------------------------------------------------- */

describe('stock', () => {
  it('recus moins vendus', () => {
    const e = etat({
      journees: [journee('2026-07-10', 1000), journee('2026-07-11', 1000)],
      depenses: [reappro('2026-07-01', 1200, 9000)],
    })
    expect(M.gallonsEnStock(e)).toBeCloseTo(1120, 6) // 1 200 - 80
  })

  it('l autonomie se fonde sur le rythme recent', () => {
    const ref = new Date(2026, 6, 15) // 15 juillet 2026
    const journees = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 6, 15 - i)
      journees.push(journee(cleJour(d), 1000)) // 40 gallons/jour
    }
    const e = etat({ journees, depenses: [reappro('2026-07-01', 1200, 9000)] })
    const stock = M.gallonsEnStock(e) // 1 200 - 280 = 920
    expect(stock).toBeCloseTo(920, 6)
    expect(M.joursDeStock(e, ref)).toBeCloseTo(23, 6) // 920 / 40
  })

  it("renvoie null sans historique de vente", () => {
    const e = etat({ depenses: [reappro('2026-07-01', 1200, 9000)] })
    expect(M.joursDeStock(e, new Date(2026, 6, 15))).toBeNull()
  })
})

/* --------------------------------------------------------------------------
   Variation du prix d appro
   -------------------------------------------------------------------------- */

describe('variationDernierPrix', () => {
  it('detecte une hausse et son ampleur', () => {
    const e = etat({
      depenses: [reappro('2026-07-01', 1200, 8400), reappro('2026-07-15', 1200, 9600)],
    })
    const v = M.variationDernierPrix(e)
    expect(v.avant).toBeCloseTo(7, 4)
    expect(v.apres).toBeCloseTo(8, 4)
    expect(v.sens).toBe('hausse')
    expect(v.deltaPct).toBeCloseTo(14.2857, 3)
  })

  it("renvoie null avec un seul reapprovisionnement — rien a comparer", () => {
    expect(M.variationDernierPrix(etat({ depenses: [reappro('2026-07-01', 1200, 9000)] }))).toBeNull()
  })

  it('renvoie null sans aucun reapprovisionnement', () => {
    expect(M.variationDernierPrix(etat())).toBeNull()
  })
})

/* --------------------------------------------------------------------------
   Historisation du prix de vente
   -------------------------------------------------------------------------- */

describe('historisation du prix de vente', () => {
  it("changer le prix courant ne touche aucune journee passee", () => {
    const passees = [journee('2026-07-10', 1000, { prix: 25 }), journee('2026-07-11', 2000, { prix: 25 })]
    const avant = passees.map((j) => ({ gallons: j.gallons, prix: j.prix_reference }))

    // L'utilisateur passe son prix de vente a 30 HTG.
    const e = etat({ journees: passees, prix: 30 })

    expect(M.gallonsVendus(e, P)).toBeCloseTo(120, 6) // 40 + 80, calcules a 25
    e.journees.forEach((j, i) => {
      expect(j.gallons).toBeCloseTo(avant[i].gallons, 10)
      expect(j.prix_reference).toBe(25)
    })
    // Seule la marge « actuelle » suit le nouveau prix.
    const eAvecAppro = { ...e, depenses: [reappro('2026-07-01', 1200, 9000)] }
    expect(M.margeActuelle(eAvecAppro).prix).toBe(30)
  })

  it('le prix de vente moyen reflete un changement en cours de periode', () => {
    const e = etat({
      journees: [journee('2026-07-10', 1000, { prix: 25 }), journee('2026-07-20', 1200, { prix: 30 })],
      prix: 30,
    })
    // 40 gallons a 25 + 40 gallons a 30 = 80 gallons pour 2 200 HTG -> 27,50
    expect(M.gallonsVendus(e, P)).toBeCloseTo(80, 6)
    expect(M.prixVenteMoyen(e, P)).toBeCloseTo(27.5, 6)
  })
})

/* --------------------------------------------------------------------------
   Mode compteur
   -------------------------------------------------------------------------- */

describe('ecartCaisse', () => {
  it('revele un manquant quand les gallons sont MESURES', () => {
    const j = journee('2026-07-10', 5000, { gallons: 220, source: 'compteur' })
    const r = M.ecartCaisse(j)
    expect(r.attendu).toBe(5500) // 220 x 25
    expect(r.ecart).toBe(-500)
    expect(r.prixMoyenReel).toBeCloseTo(22.7272, 3)
  })

  it("renvoie null en mode estime — l'ecart y serait mecaniquement nul", () => {
    expect(M.ecartCaisse(journee('2026-07-10', 5000))).toBeNull()
  })
})

/* --------------------------------------------------------------------------
   Series
   -------------------------------------------------------------------------- */

describe('series', () => {
  it('la serie quotidienne comble les jours sans activite', () => {
    const e = etat({ journees: [journee('2026-07-01', 1000), journee('2026-07-03', 2000)] })
    const s = M.serieQuotidienne(e, M.creerPeriode('2026-07-01', '2026-07-03'))
    expect(s).toHaveLength(3)
    expect(s[1].date).toBe('2026-07-02')
    expect(s[1].revenus).toBe(0)
    expect(s[2].revenus).toBe(2000)
  })

  it('le net quotidien retranche les depenses du bon jour', () => {
    const e = etat({
      journees: [journee('2026-07-02', 1000)],
      depenses: [materiel('2026-07-02', 400)],
    })
    const s = M.serieQuotidienne(e, M.creerPeriode('2026-07-01', '2026-07-03'))
    expect(s[1].net).toBe(600)
  })

  it('la semaine commence le lundi', () => {
    // 2026-07-20 est un lundi.
    const e = etat({ journees: [journee('2026-07-20', 1000)] })
    const s = M.serieSemaine(e, P)
    expect(s[0].montant).toBe(1000)
    expect(s[6].montant).toBe(0)
  })

  it("compare des moyennes, pour qu'une journee oubliee ne creuse pas son jour", () => {
    // Quatre samedis a 3 000 HTG, mais un seul a ete saisi.
    // Trois mardis a 2 000 HTG, tous saisis.
    const e = etat({
      journees: [
        journee('2026-07-04', 3000), // samedi, le seul saisi
        journee('2026-07-07', 2000), // mardi
        journee('2026-07-14', 2000), // mardi
        journee('2026-07-21', 2000), // mardi
      ],
    })
    const s = M.serieSemaine(e, M.creerPeriode('2026-07-01', '2026-07-31'))
    const mardi = s[1]
    const samedi = s[5]

    // Le total ferait passer samedi (3 000) pour un jour plus faible que
    // mardi (6 000), ce qui serait faux.
    expect(samedi.montant).toBeLessThan(mardi.montant)
    // La moyenne retablit la verite : le samedi vend mieux.
    expect(samedi.moyenne).toBe(3000)
    expect(mardi.moyenne).toBe(2000)
    expect(samedi.moyenne).toBeGreaterThan(mardi.moyenne)
    // Le nombre de journees reste expose, pour nuancer une moyenne fragile.
    expect(samedi.nb).toBe(1)
    expect(mardi.nb).toBe(3)
  })

  it('un jour sans aucune journee saisie vaut zero, pas NaN', () => {
    const e = etat({ journees: [journee('2026-07-20', 1000)] })
    const s = M.serieSemaine(e, P)
    expect(s[6].moyenne).toBe(0)
    expect(Number.isNaN(s[6].moyenne)).toBe(false)
  })
})

/* --------------------------------------------------------------------------
   Suivi par approvisionnement — repartition FIFO
   -------------------------------------------------------------------------- */

describe('suiviApprovisionnements', () => {
  it('attribue les ventes au camion et calcule ce qu il a rapporte', () => {
    // 1 200 gallons a 7,50 ; on vend 40 gallons/jour pendant 10 jours a 25 HTG.
    const journees = []
    for (let i = 1; i <= 10; i++) {
      journees.push(journee(`2026-07-${String(i).padStart(2, '0')}`, 1000))
    }
    const e = etat({ journees, depenses: [reappro('2026-06-30', 1200, 9000)] })

    const { lots } = M.suiviApprovisionnements(e)
    expect(lots).toHaveLength(1)

    const l = lots[0]
    expect(l.vendus).toBeCloseTo(400, 6)
    expect(l.restant).toBeCloseTo(800, 6)
    expect(l.revenu).toBeCloseTo(10000, 6) // 400 x 25
    expect(l.coutEcoule).toBeCloseTo(3000, 6) // 400 x 7,50
    expect(l.marge).toBeCloseTo(7000, 6)
    expect(l.margeParGallon).toBeCloseTo(17.5, 6)
    expect(l.statut).toBe('en-cours')
    expect(l.jours).toBe(10)
  })

  it('remplit le premier camion avant d entamer le second', () => {
    // 100 gallons a 7,00 puis 100 a 8,00 ; on vend 150 gallons au total.
    const e = etat({
      journees: [journee('2026-07-10', 2500), journee('2026-07-11', 1250)], // 100 + 50
      depenses: [reappro('2026-07-01', 100, 700), reappro('2026-07-05', 100, 800)],
    })
    const { lots } = M.suiviApprovisionnements(e)
    const [recent, ancien] = lots // renvoyes du plus recent au plus ancien

    expect(ancien.vendus).toBeCloseTo(100, 6)
    expect(ancien.statut).toBe('epuise')
    expect(ancien.marge).toBeCloseTo(100 * 25 - 700, 6)

    expect(recent.vendus).toBeCloseTo(50, 6)
    expect(recent.restant).toBeCloseTo(50, 6)
    expect(recent.statut).toBe('en-cours')
    expect(recent.marge).toBeCloseTo(50 * 25 - 50 * 8, 6)
  })

  it("ne rattache pas une vente a un camion livre APRES elle", () => {
    const e = etat({
      journees: [journee('2026-07-01', 1000)], // 40 gallons vendus le 1er
      depenses: [reappro('2026-07-15', 1200, 9000)], // camion livre le 15
    })
    const r = M.suiviApprovisionnements(e)
    expect(r.nonAttribue).toBeCloseTo(40, 6)
    expect(r.revenuNonAttribue).toBeCloseTo(1000, 6)
    expect(r.lots[0].vendus).toBe(0)
    expect(r.lots[0].statut).toBe('en-attente')
  })

  it('signale le surplus vendu au-dela de ce qui a ete recu', () => {
    // Stock d'avant l'application : on vend 200 gallons pour un camion de 100.
    const e = etat({
      journees: [journee('2026-07-10', 5000)],
      depenses: [reappro('2026-07-01', 100, 700)],
    })
    const r = M.suiviApprovisionnements(e)
    expect(r.lots[0].vendus).toBeCloseTo(100, 6)
    expect(r.nonAttribue).toBeCloseTo(100, 6)
  })

  it('valorise chaque vente au prix du jour, pas au prix courant', () => {
    // Le prix de vente passe de 25 a 30 pendant l'ecoulement du meme camion.
    const e = etat({
      journees: [
        journee('2026-07-10', 1000, { prix: 25 }), // 40 gallons a 25
        journee('2026-07-11', 1200, { prix: 30 }), // 40 gallons a 30
      ],
      depenses: [reappro('2026-07-01', 1200, 9000)],
    })
    const l = M.suiviApprovisionnements(e).lots[0]
    expect(l.vendus).toBeCloseTo(80, 6)
    expect(l.revenu).toBeCloseTo(2200, 6)
    expect(l.prixVenteMoyen).toBeCloseTo(27.5, 6)
  })

  it('la somme des revenus attribues egale le total encaisse', () => {
    const e = etat({
      journees: [journee('2026-07-10', 1000), journee('2026-07-12', 2000)],
      depenses: [reappro('2026-07-01', 100, 700), reappro('2026-07-05', 100, 800)],
    })
    const r = M.suiviApprovisionnements(e)
    const total = r.lots.reduce((t, l) => t + l.revenu, 0) + r.revenuNonAttribue
    expect(total).toBeCloseTo(M.totalRevenus(e, M.TOUT), 6)
  })

  it('renvoie null sans aucun approvisionnement', () => {
    expect(M.suiviApprovisionnements(etat({ journees: [journee('2026-07-10', 1000)] }))).toBeNull()
  })

  it('conserve le detail jour par jour des ventes', () => {
    const e = etat({
      journees: [journee('2026-07-10', 1000), journee('2026-07-11', 2000)],
      depenses: [reappro('2026-07-01', 1200, 9000)],
    })
    const l = M.suiviApprovisionnements(e).lots[0]
    expect(l.ventes).toHaveLength(2)
    expect(l.ventes[0]).toMatchObject({ date: '2026-07-10', gallons: 40, revenu: 1000 })
    expect(l.ventes[1]).toMatchObject({ date: '2026-07-11', gallons: 80, revenu: 2000 })
    // Somme du detail = revenu du lot : aucune fuite dans la ventilation.
    expect(l.ventes.reduce((t, v) => t + v.revenu, 0)).toBeCloseTo(l.revenu, 6)
  })

  it('signale la journee partagee entre deux camions', () => {
    // 100 gallons en stock, on en vend 150 le meme jour : le camion suivant
    // prend le relais en cours de journee.
    const e = etat({
      journees: [journee('2026-07-10', 3750)], // 150 gallons
      depenses: [reappro('2026-07-01', 100, 700), reappro('2026-07-05', 100, 800)],
    })
    const { lots } = M.suiviApprovisionnements(e)
    const ancien = lots[1]
    const recent = lots[0]
    expect(ancien.ventes[0]).toMatchObject({ gallons: 100, partielle: true })
    expect(recent.ventes[0]).toMatchObject({ gallons: 50, partielle: true })
  })
})

/* --------------------------------------------------------------------------
   Depenses rattachees a une livraison
   -------------------------------------------------------------------------- */

describe('depenses par approvisionnement', () => {
  it('rattache chaque depense au camion en cours d ecoulement', () => {
    const e = etat({
      journees: [
        journee('2026-07-02', 2500), // 100 gal -> epuise le camion 1
        journee('2026-07-08', 1250), // 50 gal  -> entame le camion 2
      ],
      depenses: [
        reappro('2026-07-01', 100, 700),
        reappro('2026-07-05', 100, 800),
        materiel('2026-07-03', 400), // pendant le camion 1
        materiel('2026-07-09', 600), // pendant le camion 2
      ],
    })
    const { lots } = M.suiviApprovisionnements(e)
    const [recent, ancien] = lots

    expect(ancien.autresDepenses.map((d) => d.total)).toEqual([400])
    expect(recent.autresDepenses.map((d) => d.total)).toEqual([600])
  })

  it("retranche ces depenses du benefice net de la livraison", () => {
    const e = etat({
      journees: [journee('2026-07-02', 2500)], // 100 gal a 25 = 2 500
      depenses: [reappro('2026-07-01', 100, 700), materiel('2026-07-03', 400)],
    })
    const l = M.suiviApprovisionnements(e).lots[0]
    expect(l.marge).toBeCloseTo(1800, 6) // 2 500 - 700
    expect(l.totalAutresDepenses).toBeCloseTo(400, 6)
    expect(l.beneficeNet).toBeCloseTo(1400, 6) // 1 800 - 400
  })

  it("ne compte aucune depense deux fois", () => {
    const e = etat({
      journees: [
        journee('2026-07-02', 2500),
        journee('2026-07-08', 2500),
        journee('2026-07-14', 1250),
      ],
      depenses: [
        reappro('2026-07-01', 100, 700),
        reappro('2026-07-05', 100, 800),
        reappro('2026-07-12', 100, 800),
        materiel('2026-07-03', 400),
        materiel('2026-07-09', 600),
        materiel('2026-07-15', 900),
      ],
    })
    const r = M.suiviApprovisionnements(e)
    const rattachees = r.lots.flatMap((l) => l.autresDepenses.map((d) => d.id))
    expect(new Set(rattachees).size).toBe(rattachees.length)
    expect(rattachees.length + r.depensesOrphelines.length).toBe(3)
  })

  it("laisse orpheline une depense anterieure a toute vente", () => {
    const e = etat({
      journees: [journee('2026-07-10', 2500)],
      depenses: [reappro('2026-07-01', 100, 700), materiel('2026-07-02', 400)],
    })
    const r = M.suiviApprovisionnements(e)
    expect(r.depensesOrphelines.map((d) => d.total)).toEqual([400])
    expect(r.lots[0].autresDepenses).toHaveLength(0)
  })
})

/* --------------------------------------------------------------------------
   Comparaison mois a mois, a durees egales
   -------------------------------------------------------------------------- */

describe('moisPrecedentAuMemeJour', () => {
  it('tronque le mois precedent au meme quantieme', () => {
    // Le 19 juillet, on compare au 1er-19 juin, pas au mois de juin entier.
    const p = M.moisPrecedentAuMemeJour(new Date(2026, 6, 19))
    expect(p).toEqual({ debut: '2026-06-01', fin: '2026-06-19' })
  })

  it('borne au dernier jour quand le mois precedent est plus court', () => {
    // Le 31 mars n'a pas d'equivalent en fevrier : on s'arrete au 28.
    const p = M.moisPrecedentAuMemeJour(new Date(2026, 2, 31))
    expect(p).toEqual({ debut: '2026-02-01', fin: '2026-02-28' })
  })

  it("ne fabrique pas une baisse artificielle en debut de mois", () => {
    // Meme activite quotidienne des deux cotes : la variation doit etre nulle.
    const journees = []
    for (let i = 1; i <= 30; i++) {
      journees.push(journee(`2026-06-${String(i).padStart(2, '0')}`, 1000))
    }
    for (let i = 1; i <= 5; i++) {
      journees.push(journee(`2026-07-0${i}`, 1000))
    }
    const e = etat({ journees })
    const ref = new Date(2026, 6, 5)

    const courant = M.totalRevenus(e, M.moisCourant(ref))
    const equitable = M.totalRevenus(e, M.moisPrecedentAuMemeJour(ref))
    expect(M.variationPct(courant, equitable)).toBe(0)

    // La comparaison naive au mois complet donnerait −83 %, ce qui serait faux.
    const naif = M.totalRevenus(e, M.moisPrecedent(ref))
    expect(M.variationPct(courant, naif)).toBeLessThan(-80)
  })
})

/* --------------------------------------------------------------------------
   Cumul du benefice
   -------------------------------------------------------------------------- */

describe('serieNetteCumulee', () => {
  it('accumule et encaisse le creux d un reapprovisionnement', () => {
    const e = etat({
      journees: [
        journee('2026-07-01', 1000),
        journee('2026-07-02', 1000),
        journee('2026-07-03', 1000),
      ],
      depenses: [reappro('2026-07-02', 1200, 9000)],
    })
    const s = M.serieNetteCumulee(e, M.creerPeriode('2026-07-01', '2026-07-03'))
    expect(s.map((x) => x.cumul)).toEqual([1000, -7000, -6000])
  })
})

/* --------------------------------------------------------------------------
   Journees non cloturees
   -------------------------------------------------------------------------- */

describe('joursNonClotures', () => {
  it('liste les trous entre la premiere activite et hier', () => {
    const e = etat({ journees: [journee('2026-07-18', 1000), journee('2026-07-20', 1000)] })
    expect(M.joursNonClotures(e, new Date(2026, 6, 21))).toEqual(['2026-07-19'])
  })

  it("n'inclut jamais aujourd hui — la journee n'est pas finie", () => {
    const e = etat({ journees: [journee('2026-07-18', 1000)] })
    expect(M.joursNonClotures(e, new Date(2026, 6, 20))).toEqual(['2026-07-19'])
  })

  it("ne reclame rien sur une base vide", () => {
    expect(M.joursNonClotures(etat(), new Date(2026, 6, 20))).toEqual([])
  })
})

/* --------------------------------------------------------------------------
   Previsions
   -------------------------------------------------------------------------- */

/** Genere `nb` journees consecutives finissant a `fin`, via une fonction. */
function historique(fin, nb, montantPour) {
  const out = []
  for (let i = nb - 1; i >= 0; i--) {
    const d = new Date(fin)
    d.setDate(d.getDate() - i)
    out.push(journee(cleJour(d), montantPour(d)))
  }
  return out
}

describe('moyennesParJourSemaine', () => {
  it('separe bien les jours de la semaine', () => {
    const ref = new Date(2026, 6, 20) // lundi
    // Week-end a 3 000, semaine a 2 000.
    const e = etat({
      journees: historique(ref, 28, (d) => ([0, 6].includes(d.getDay()) ? 3000 : 2000)),
    })
    const p = M.moyennesParJourSemaine(e, { reference: ref })

    expect(p[0].moyenne).toBe(2000) // lundi
    expect(p[5].moyenne).toBe(3000) // samedi
    expect(p[6].moyenne).toBe(3000) // dimanche
    expect(p[0].nb).toBeGreaterThan(0)
  })

  it('signale un jour sans historique plutot que de renvoyer zero', () => {
    const e = etat({ journees: [journee('2026-07-20', 2000)] }) // un lundi
    const p = M.moyennesParJourSemaine(e, { reference: new Date(2026, 6, 20) })
    expect(p[0].moyenne).toBe(2000)
    expect(p[1].moyenne).toBeNull() // mardi : aucune donnee
    expect(p[1].nb).toBe(0)
  })
})

describe('previsionMois', () => {
  it("n'extrapole jamais le realise, seulement les jours a venir", () => {
    const ref = new Date(2026, 6, 20) // lundi 20 juillet
    const e = etat({ journees: historique(ref, 28, () => 2000) })
    const p = M.previsionMois(e, ref)

    // Realise = du 1er au 20 juillet inclus = 20 jours a 2 000.
    expect(p.realise).toBe(40000)
    // Restants = du 21 au 31 = 11 jours.
    expect(p.joursRestants).toHaveLength(11)
    expect(p.attendu).toBeCloseTo(22000, 6)
    expect(p.total).toBeCloseTo(62000, 6)
  })

  it('tient compte des jours de la semaine qui RESTENT, pas d une moyenne plate', () => {
    const ref = new Date(2026, 6, 20)
    // Week-ends deux fois plus rentables que la semaine.
    const e = etat({
      journees: historique(ref, 28, (d) => ([0, 6].includes(d.getDay()) ? 4000 : 2000)),
    })
    const p = M.previsionMois(e, ref)

    // Du 21 au 31 juillet 2026 : 9 jours de semaine et seulement 2 de
    // week-end (samedi 25, dimanche 26).
    expect(p.attendu).toBeCloseTo(9 * 2000 + 2 * 4000, 6) // 26 000

    // Une moyenne plate sur les 28 jours observes vaudrait 2 571 HTG/jour,
    // soit 28 286 pour 11 jours — elle surestimerait de plus de 2 000 HTG
    // parce qu'elle ignore que peu de week-ends restent a venir.
    const plate = ((8 * 4000 + 20 * 2000) / 28) * 11
    expect(plate).toBeGreaterThan(p.attendu + 2000)
  })

  it('encadre la prevision par une fourchette, jamais un chiffre nu', () => {
    const ref = new Date(2026, 6, 20)
    const e = etat({
      journees: historique(ref, 28, (d) => 2000 + ((d.getDate() * 137) % 800)),
    })
    const p = M.previsionMois(e, ref)
    expect(p.bas).toBeLessThan(p.total)
    expect(p.haut).toBeGreaterThan(p.total)
    // La borne basse ne peut pas descendre sous ce qui est deja encaisse.
    expect(p.bas).toBeGreaterThanOrEqual(p.realise)
  })

  it("annonce une fiabilite faible sur un historique trop court", () => {
    const ref = new Date(2026, 6, 20)
    const e = etat({ journees: historique(ref, 3, () => 2000) })
    expect(M.previsionMois(e, ref).fiabilite.niveau).toBe('faible')
  })

  it('annonce une bonne fiabilite sur une activite reguliere et longue', () => {
    const ref = new Date(2026, 6, 20)
    const e = etat({ journees: historique(ref, 42, () => 2000) })
    expect(M.previsionMois(e, ref).fiabilite.niveau).toBe('bonne')
  })

  it('renvoie null sans aucun historique', () => {
    expect(M.previsionMois(etat(), new Date(2026, 6, 20))).toBeNull()
  })
})

describe('previsionRupture', () => {
  it('estime la date de rupture et recule la date de commande', () => {
    const ref = new Date(2026, 6, 20)
    // 40 gallons/jour vendus, 400 gallons en stock -> ~10 jours.
    const e = etat({
      journees: historique(ref, 28, () => 1000),
      depenses: [reappro('2026-06-01', 1520, 11400)], // 1520 recus - 1120 vendus = 400
    })
    const r = M.previsionRupture(e, ref, { delaiCommande: 2 })

    expect(r.stock).toBeCloseTo(400, 6)
    expect(r.jours).toBe(10)
    expect(r.date).toBe('2026-07-30')
    expect(r.dateCommande).toBe('2026-07-28')
    expect(r.urgent).toBe(false)
  })

  it('signale l urgence quand la rupture tombe dans le delai de commande', () => {
    const ref = new Date(2026, 6, 20)
    const e = etat({
      journees: historique(ref, 28, () => 1000),
      depenses: [reappro('2026-06-01', 1160, 8700)], // ~40 gallons restants
    })
    const r = M.previsionRupture(e, ref, { delaiCommande: 2 })
    expect(r.urgent).toBe(true)
  })

  it('renvoie null sans historique de vente', () => {
    const e = etat({ depenses: [reappro('2026-07-01', 1200, 9000)] })
    expect(M.previsionRupture(e, new Date(2026, 6, 20))).toBeNull()
  })
})

describe('seriePrevision', () => {
  it('raccorde la courbe projetee au dernier point realise', () => {
    const ref = new Date(2026, 6, 20)
    const e = etat({ journees: historique(ref, 28, () => 2000) })
    const s = M.seriePrevision(e, ref)

    const dernierRealise = s.filter((p) => p.realise != null).at(-1)
    // Le point de jonction porte les deux valeurs : sans cela, un trou
    // apparaitrait entre la courbe pleine et la courbe pointillee.
    expect(dernierRealise.projete).toBe(dernierRealise.realise)
    expect(s.at(-1).date).toBe('2026-07-31')
  })
})

/* --------------------------------------------------------------------------
   Cas degeneres : jamais NaN, jamais Infinity
   -------------------------------------------------------------------------- */

describe('cas degeneres', () => {
  const vide = etat()
  it('les totaux valent zero, pas NaN', () => {
    expect(M.totalRevenus(vide, P)).toBe(0)
    expect(M.totalDepenses(vide, P)).toBe(0)
    expect(M.beneficeNet(vide, P)).toBe(0)
    expect(M.gallonsEnStock(vide)).toBe(0)
  })

  it('les ratios renvoient null', () => {
    for (const v of [
      M.prixVenteMoyen(vide, P),
      M.coutMoyenPondere(vide, P),
      M.margeActuelle(vide),
      M.margePeriode(vide, P),
      M.splitPaiement(vide, P),
      M.joursDeStock(vide),
      M.dernierCoutGallon(vide),
      M.variationPct(100, 0),
    ]) {
      expect(v).toBeNull()
    }
  })

  it('un reappro a quantite nulle est ignore et ne divise jamais par zero', () => {
    const e = etat({ depenses: [reappro('2026-07-01', 0, 500)] })
    expect(M.coutMoyenPondere(e, P)).toBeNull()
    expect(M.dernierCoutGallon(e)).toBeNull()
    expect(Number.isNaN(M.gallonsRecus(e, P))).toBe(false)
  })
})

/* --------------------------------------------------------------------------
   Formatage
   -------------------------------------------------------------------------- */

describe('format', () => {
  it('formate les gourdes sans decimale', () => {
    expect(formatHTG(1250)).toMatch(/^1.250 HTG$/)
    expect(formatHTG(0)).toMatch(/^0 HTG$/)
    expect(formatHTG(null)).toBe('—')
  })

  it('affiche un signe explicite quand on le demande', () => {
    expect(formatHTG(125, { signe: true }).startsWith('+')).toBe(true)
    expect(formatHTG(-125, { signe: true }).startsWith('−')).toBe(true)
  })

  it('formate les prix unitaires avec deux decimales', () => {
    expect(formatPrix(7.5)).toBe('7,50 HTG')
    expect(formatPrix(25)).toBe('25,00 HTG')
  })

  it('écrit les mois avec leurs accents', () => {
    expect(formatDateLongue('2026-08-01')).toContain('août')
    expect(formatDateLongue('2026-02-01')).toContain('février')
    expect(formatDateLongue('2026-12-01')).toContain('décembre')
    expect(formatDateCourte('2026-08-01')).toContain('août')
  })

  it('accorde le mot gallon', () => {
    expect(formatGallons(1)).toBe('1 gallon')
    expect(formatGallons(40)).toBe('40 gallons')
  })

  it('cleJour reste en heure locale — pas de decalage UTC', () => {
    // A Haiti (UTC-5), toISOString() ferait basculer cette date au 21.
    expect(cleJour(new Date(2026, 6, 20, 22, 30))).toBe('2026-07-20')
    expect(cleJour(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })

  it('lireNombre accepte la virgule et les espaces', () => {
    expect(lireNombre('7,50')).toBe(7.5)
    expect(lireNombre('1 200')).toBe(1200)
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('abc')).toBeNull()
    expect(lireNombre('0')).toBe(0)
  })
})
