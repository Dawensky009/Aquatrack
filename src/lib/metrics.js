/**
 * Calculs metier de Aqua Track.
 *
 * Module PUR : aucune dependance a React ni a IndexedDB. Toutes les fonctions
 * prennent un `etat` en premier argument et ne lisent rien d'autre. C'est ce
 * qui les rend testables isolement — et elles le sont, car c'est ici que se
 * trouvent les erreurs les plus couteuses.
 *
 * Forme de `etat` :
 *   { journees: [], depenses: [], categories: [], reglages: {} }
 *
 * Trois regles tenues partout dans ce fichier :
 *
 *   1. Tout denominateur potentiellement nul renvoie `null`, jamais NaN ni
 *      Infinity. L'UI affiche alors un etat vide explicite plutot qu'un
 *      chiffre absurde.
 *   2. Les moyennes de prix sont PONDEREES par les volumes. Faire la moyenne
 *      simple de deux prix d'achat fausserait silencieusement toute la marge.
 *   3. Les lignes supprimees (`deleted`) sont exclues systematiquement.
 */

import { cleJour, depuisCleJour } from './format.js'

/* ==========================================================================
   Periodes
   ========================================================================== */

/** Une periode est un intervalle de cles jour, bornes incluses. */
export function creerPeriode(debut, fin) {
  return { debut, fin }
}

export function moisCourant(reference = new Date()) {
  const a = reference.getFullYear()
  const m = reference.getMonth()
  return creerPeriode(cleJour(new Date(a, m, 1)), cleJour(new Date(a, m + 1, 0)))
}

export function moisPrecedent(reference = new Date()) {
  const a = reference.getFullYear()
  const m = reference.getMonth()
  return creerPeriode(cleJour(new Date(a, m - 1, 1)), cleJour(new Date(a, m, 0)))
}

/** Les `n` derniers jours, aujourd'hui inclus. */
export function derniersJours(n, reference = new Date()) {
  const fin = new Date(reference)
  const debut = new Date(reference)
  debut.setDate(debut.getDate() - (n - 1))
  return creerPeriode(cleJour(debut), cleJour(fin))
}

/** Les `n` derniers mois, mois courant inclus. */
export function derniersMois(n, reference = new Date()) {
  const a = reference.getFullYear()
  const m = reference.getMonth()
  return creerPeriode(cleJour(new Date(a, m - (n - 1), 1)), cleJour(new Date(a, m + 1, 0)))
}

/** Periode ouverte : tout l'historique. */
export const TOUT = creerPeriode('0000-01-01', '9999-12-31')

/* ==========================================================================
   Acces aux lignes
   ========================================================================== */

const vivant = (l) => !l.deleted

/** Les depenses portent un horodatage complet ; on n'en garde que le jour. */
const jourDepense = (d) => cleJour(new Date(d.occurred_at))

function dansPeriode(cle, periode) {
  if (!periode) return true
  return cle >= periode.debut && cle <= periode.fin
}

export function journeesDe(etat, periode) {
  return (etat.journees || []).filter((j) => vivant(j) && dansPeriode(j.date, periode))
}

export function depensesDe(etat, periode) {
  return (etat.depenses || []).filter((d) => vivant(d) && dansPeriode(jourDepense(d), periode))
}

/**
 * Une categorie « suit les gallons » identifie les reapprovisionnements.
 * C'est un reglage utilisateur, pas un nom code en dur : l'utilisateur peut
 * renommer « Reapprovisionnement d'eau » sans rien casser.
 */
export function categoriesAppro(etat) {
  return (etat.categories || []).filter((c) => vivant(c) && c.suit_gallons)
}

function estAppro(etat, depense) {
  return categoriesAppro(etat).some((c) => c.id === depense.category_id)
}

export function reapprosDe(etat, periode) {
  return depensesDe(etat, periode).filter((d) => estAppro(etat, d) && d.quantity > 0)
}

const somme = (liste, fn) => liste.reduce((t, x) => t + (fn(x) || 0), 0)

/* ==========================================================================
   Registre
   ========================================================================== */

export function totalRevenus(etat, periode) {
  return somme(journeesDe(etat, periode), (j) => j.montant)
}

export function totalDepenses(etat, periode) {
  return somme(depensesDe(etat, periode), (d) => d.total)
}

export function beneficeNet(etat, periode) {
  return totalRevenus(etat, periode) - totalDepenses(etat, periode)
}

/**
 * Repartition Cash / MonCash des encaissements.
 * `moncash` est la part encaissee par mobile ; le reste est du liquide.
 */
export function splitPaiement(etat, periode) {
  const js = journeesDe(etat, periode)
  const moncash = somme(js, (j) => j.moncash)
  const total = somme(js, (j) => j.montant)
  const cash = total - moncash
  if (total <= 0) return null
  return { cash, moncash, total, partCash: cash / total, partMoncash: moncash / total }
}

/* ==========================================================================
   Volumes et stock
   ========================================================================== */

export function gallonsVendus(etat, periode) {
  return somme(journeesDe(etat, periode), (j) => j.gallons)
}

export function gallonsRecus(etat, periode) {
  return somme(reapprosDe(etat, periode), (d) => d.quantity)
}

/**
 * Stock reel en citerne : tout ce qui est entre moins tout ce qui est sorti,
 * depuis le debut. Volontairement non borne a une periode — un stock est un
 * etat instantane, pas un flux.
 *
 * Tant que le compteur physique n'est pas installe, les gallons vendus sont
 * deduits du montant encaisse. Ce stock est donc theorique : il ne peut pas
 * revèler une fuite ni un manquant. C'est precisement ce que le compteur
 * corrigera.
 */
export function gallonsEnStock(etat) {
  return gallonsRecus(etat, TOUT) - gallonsVendus(etat, TOUT)
}

/**
 * Autonomie estimee, en jours, au rythme des 7 derniers jours d'activite.
 * Renvoie null s'il n'y a aucune vente sur lesquelles se fonder.
 */
export function joursDeStock(etat, reference = new Date()) {
  const recents = journeesDe(etat, derniersJours(7, reference))
  if (recents.length === 0) return null
  const moyenne = gallonsVendus(etat, derniersJours(7, reference)) / recents.length
  if (moyenne <= 0) return null
  return gallonsEnStock(etat) / moyenne
}

/* ==========================================================================
   Approvisionnement
   ========================================================================== */

/**
 * Historique des prix payes a la compagnie, du plus ancien au plus recent.
 * Le cout par gallon est toujours recalcule depuis `total / quantity` : peu
 * importe que la saisie ait ete faite au forfait camion ou au prix unitaire,
 * la serie reste comparable.
 */
export function historiquePrixAppro(etat, periode) {
  return reapprosDe(etat, periode)
    .map((d) => ({
      id: d.id,
      date: jourDepense(d),
      occurred_at: d.occurred_at,
      gallons: d.quantity,
      total: d.total,
      coutGallon: d.total / d.quantity,
    }))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
}

export function dernierCoutGallon(etat) {
  const h = historiquePrixAppro(etat, TOUT)
  return h.length ? h[h.length - 1].coutGallon : null
}

/**
 * Evolution entre les deux derniers reapprovisionnements.
 * Renvoie null s'il n'y en a qu'un : il n'y a alors rien a comparer.
 */
export function variationDernierPrix(etat) {
  const h = historiquePrixAppro(etat, TOUT)
  if (h.length < 2) return null
  const avant = h[h.length - 2].coutGallon
  const apres = h[h.length - 1].coutGallon
  if (avant === 0) return null
  const deltaPct = ((apres - avant) / avant) * 100
  return {
    avant,
    apres,
    deltaPct,
    sens: apres > avant ? 'hausse' : apres < avant ? 'baisse' : 'stable',
  }
}

/**
 * Cout moyen d'un gallon achete sur la periode.
 *
 * PONDERE PAR LES VOLUMES, et c'est essentiel : 1 200 gallons a 7,00 HTG
 * puis 600 gallons a 8,00 HTG donnent 7,33 HTG, pas 7,50. La moyenne simple
 * surestimerait le cout du petit achat et fausserait toute la marge.
 */
export function coutMoyenPondere(etat, periode) {
  const rs = reapprosDe(etat, periode)
  const gallons = somme(rs, (d) => d.quantity)
  if (gallons <= 0) return null
  return somme(rs, (d) => d.total) / gallons
}

/* ==========================================================================
   Suivi par approvisionnement
   ========================================================================== */

/**
 * Rattache les ventes aux camions qui les ont fournies, et calcule ce que
 * chaque camion a rapporte.
 *
 * Repartition en FIFO : l'eau la plus ancienne part la premiere. C'est ce qui
 * se passe reellement dans une citerne qu'on remplit par le haut et qu'on
 * vide par le bas, et c'est la seule regle qui permette de dire « ce camion-la
 * m'a rapporte tant » plutot que de noyer chaque achat dans une moyenne.
 *
 * Chaque journee de vente est valorisee au prix REELLEMENT obtenu ce jour-la
 * (montant / gallons), donc une hausse du prix de vente en cours d'ecoulement
 * est correctement attribuee au camion concerne.
 *
 * Renvoie aussi `nonAttribue` : les gallons vendus qu'aucun camion enregistre
 * ne peut expliquer. Ce n'est pas une erreur — c'est le stock qui existait
 * avant l'installation de l'application, ou un achat oublie.
 */
export function suiviApprovisionnements(etat) {
  const lots = historiquePrixAppro(etat, TOUT).map((r) => ({
    id: r.id,
    date: r.date,
    gallons: r.gallons,
    cout: r.total,
    coutGallon: r.coutGallon,
    vendus: 0,
    revenu: 0,
    premiereVente: null,
    derniereVente: null,
    // Detail jour par jour, pour pouvoir ouvrir une livraison et voir d'ou
    // vient exactement son revenu.
    ventes: [],
  }))
  if (lots.length === 0) return null

  const ventes = journeesDe(etat, TOUT)
    .filter((j) => j.gallons > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  let i = 0
  let nonAttribue = 0
  let revenuNonAttribue = 0

  for (const v of ventes) {
    const prixDuJour = v.montant / v.gallons
    let restant = v.gallons

    while (restant > 1e-9) {
      // Avance jusqu'au premier camion non epuise.
      while (i < lots.length && lots[i].vendus >= lots[i].gallons - 1e-9) i++

      // Plus de camion, ou le suivant n'etait pas encore livre ce jour-la :
      // ces gallons viennent d'un stock que l'application ne connait pas.
      if (i >= lots.length || lots[i].date > v.date) {
        nonAttribue += restant
        revenuNonAttribue += restant * prixDuJour
        break
      }

      const pris = Math.min(lots[i].gallons - lots[i].vendus, restant)
      lots[i].vendus += pris
      lots[i].revenu += pris * prixDuJour
      lots[i].premiereVente ??= v.date
      lots[i].derniereVente = v.date
      lots[i].ventes.push({
        date: v.date,
        gallons: pris,
        revenu: pris * prixDuJour,
        prix: prixDuJour,
        // Une journee peut alimenter deux camions : on le signale plutot que
        // d'afficher un montant qui ne correspondrait pas a la recette du jour.
        partielle: pris < v.gallons - 1e-9,
        montantJour: v.montant,
      })
      restant -= pris
    }
  }

  /* --- Depenses rattachees a chaque livraison --------------------------- */

  // Chaque depense hors approvisionnement est rattachee au camion qui etait
  // en cours d'ecoulement ce jour-la. Ce n'est pas une causalite — acheter
  // une pompe n'est pas « du » a un camion — mais c'est la seule maniere
  // d'obtenir un benefice net par periode qui ne compte rien deux fois.
  const autres = depensesDe(etat, TOUT)
    .filter((d) => !estAppro(etat, d))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  const parLot = new Map(lots.map((l) => [l.id, []]))
  let depensesOrphelines = []

  for (const d of autres) {
    const jour = jourDepense(d)
    // Le dernier camion dont l'ecoulement avait commence a cette date.
    const lot = [...lots].reverse().find((l) => l.premiereVente && l.premiereVente <= jour)
    if (lot) parLot.get(lot.id).push(d)
    else depensesOrphelines.push(d)
  }

  const detail = lots.map((l) => {
    const coutEcoule = l.vendus * l.coutGallon
    const part = l.gallons > 0 ? l.vendus / l.gallons : 0
    const autresDepenses = parLot.get(l.id) ?? []
    const totalAutresDepenses = somme(autresDepenses, (d) => d.total)
    return {
      ...l,
      autresDepenses,
      totalAutresDepenses,
      // Marge sur l'eau MOINS les autres depenses de la periode : ce qui est
      // reellement reste en poche pendant que ce camion s'ecoulait.
      beneficeNet: l.revenu - coutEcoule - totalAutresDepenses,
      restant: Math.max(0, l.gallons - l.vendus),
      part,
      // Marge sur la portion REELLEMENT ecoulee. Retrancher le cout du camion
      // entier ferait apparaitre en perte tout camion pas encore fini.
      coutEcoule,
      marge: l.revenu - coutEcoule,
      margeParGallon: l.vendus > 0 ? (l.revenu - coutEcoule) / l.vendus : null,
      prixVenteMoyen: l.vendus > 0 ? l.revenu / l.vendus : null,
      jours:
        l.premiereVente && l.derniereVente
          ? Math.round(
              (depuisCleJour(l.derniereVente) - depuisCleJour(l.premiereVente)) / 86400000,
            ) + 1
          : null,
      statut: part >= 0.999 ? 'epuise' : l.vendus > 0 ? 'en-cours' : 'en-attente',
    }
  })

  return {
    // Du plus recent au plus ancien : c'est le camion en cours qui interesse.
    lots: detail.reverse(),
    nonAttribue,
    revenuNonAttribue,
    depensesOrphelines,
  }
}

/** Une livraison precise, avec tout son detail. */
export function detailApprovisionnement(etat, lotId) {
  const suivi = suiviApprovisionnements(etat)
  return suivi?.lots.find((l) => l.id === lotId) ?? null
}

/* ==========================================================================
   Prix de vente et marges
   ========================================================================== */

/**
 * Prix de vente moyen REELLEMENT obtenu sur la periode.
 *
 * En mode estime, les gallons derivent du montant : ce ratio redonne donc la
 * moyenne ponderee des prix de reference en vigueur. En mode compteur, les
 * gallons sont mesures : le ratio revele alors le prix reellement pratique,
 * remises et manquants compris. Dans les deux cas c'est la bonne base de
 * comparaison avec le cout d'achat.
 */
export function prixVenteMoyen(etat, periode) {
  const js = journeesDe(etat, periode)
  const gallons = somme(js, (j) => j.gallons)
  if (gallons <= 0) return null
  return somme(js, (j) => j.montant) / gallons
}

/**
 * Marge « actuelle » : prix de vente en vigueur moins le cout du dernier
 * reapprovisionnement. C'est la marge sur laquelle DECIDER — faut-il
 * augmenter le prix de vente maintenant que la compagnie a monte le sien ?
 */
export function margeActuelle(etat) {
  const cout = dernierCoutGallon(etat)
  if (cout == null) return null
  const prix = etat.reglages?.prix_vente_gallon
  if (!prix) return null
  return { prix, cout, marge: prix - cout, tauxMarge: (prix - cout) / prix }
}

/**
 * Marge de la periode : prix de vente moyen obtenu moins cout moyen pondere.
 * C'est la marge REELLEMENT realisee. Elle diverge de la marge actuelle
 * apres une hausse de la compagnie, et cet ecart est l'information utile.
 */
export function margePeriode(etat, periode) {
  const prix = prixVenteMoyen(etat, periode)
  const cout = coutMoyenPondere(etat, periode)
  if (prix == null || cout == null) return null
  return { prix, cout, marge: prix - cout, tauxMarge: (prix - cout) / prix }
}

/* ==========================================================================
   « Ou part votre argent »
   ========================================================================== */

/**
 * Ventilation des encaissements de la periode : chaque categorie de depense,
 * puis ce qui reste. Les parts somment EXACTEMENT au total encaisse.
 *
 * Un mois avec deux camions et peu de ventes peut donner un benefice negatif.
 * Un donut ne sait pas representer une part negative : on signale alors le
 * cas par `deficitaire` et l'UI bascule sur un etat distinct plutot que
 * d'afficher un graphique faux.
 */
export function ouPartArgent(etat, periode) {
  const total = totalRevenus(etat, periode)
  const ds = depensesDe(etat, periode)
  const cats = (etat.categories || []).filter(vivant)

  const parts = cats
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      couleur: c.color,
      montant: somme(
        ds.filter((d) => d.category_id === c.id),
        (d) => d.total,
      ),
    }))
    .filter((p) => p.montant > 0)

  const depense = somme(parts, (p) => p.montant)
  const benefice = total - depense

  if (total <= 0 && depense <= 0) return null
  return { total, parts, benefice, depense, deficitaire: benefice < 0 }
}

/* ==========================================================================
   Series pour les graphiques
   ========================================================================== */

function listeJours(periode) {
  const out = []
  const d = depuisCleJour(periode.debut)
  const fin = depuisCleJour(periode.fin)
  while (d <= fin) {
    out.push(cleJour(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Serie quotidienne revenus / depenses / net.
 * Les jours sans activite sont presents avec des zeros : sans cela, la courbe
 * relierait deux points distants en sautant le creux, ce qui donnerait a lire
 * une activite continue qui n'a pas eu lieu.
 */
export function serieQuotidienne(etat, periode, { rognerFin = false } = {}) {
  const parJour = new Map()
  for (const cle of listeJours(periode)) {
    parJour.set(cle, { date: cle, revenus: 0, depenses: 0, net: 0, saisi: false })
  }
  for (const j of journeesDe(etat, periode)) {
    const e = parJour.get(j.date)
    if (e) {
      e.revenus += j.montant
      e.saisi = true
    }
  }
  for (const d of depensesDe(etat, periode)) {
    const e = parJour.get(jourDepense(d))
    if (e) {
      e.depenses += d.total
      e.saisi = true
    }
  }
  for (const e of parJour.values()) e.net = e.revenus - e.depenses

  const serie = [...parJour.values()]

  // Les jours de fin sans aucune saisie sont retires : la journee en cours
  // n'est pas encore cloturee, et la tracer a zero dessinerait un effondrement
  // qui n'a pas eu lieu. Un vrai jour a zero saisi reste, lui, affiche.
  if (rognerFin) {
    let fin = serie.length
    while (fin > 0 && !serie[fin - 1].saisi) fin--
    return serie.slice(0, Math.max(fin, 1))
  }
  return serie
}

/**
 * Serie du benefice net CUMULE sur la periode.
 *
 * Le net quotidien seul est illisible : un camion a 9 000 HTG creuse un
 * gouffre isole qui se lit comme une erreur de saisie, alors que c'est un
 * achat de stock qui se revendra les semaines suivantes. Le cumul raconte la
 * vraie histoire — la progression du mois, avec un palier le jour de la
 * livraison puis une remontee.
 */
export function serieNetteCumulee(etat, periode) {
  let cumul = 0
  return serieQuotidienne(etat, periode).map((j) => {
    cumul += j.net
    return { ...j, cumul }
  })
}

/**
 * Mois precedent tronque au meme quantieme que la reference.
 *
 * Comparer un mois en cours (19 jours) a un mois precedent complet (30 jours)
 * donne toujours une baisse, quelle que soit la realite. Il faut comparer des
 * durees egales, sinon l'indicateur ment tous les debuts de mois.
 */
export function moisPrecedentAuMemeJour(reference = new Date()) {
  const a = reference.getFullYear()
  const m = reference.getMonth()
  const quantieme = reference.getDate()
  const debut = new Date(a, m - 1, 1)
  const dernierJourMoisPrecedent = new Date(a, m, 0).getDate()
  const fin = new Date(a, m - 1, Math.min(quantieme, dernierJourMoisPrecedent))
  return creerPeriode(cleJour(debut), cleJour(fin))
}

/** Serie mensuelle, pour la vue « 12 mois ». */
export function serieMensuelle(etat, nbMois, reference = new Date()) {
  const out = []
  for (let i = nbMois - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1)
    const p = creerPeriode(
      cleJour(d),
      cleJour(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    )
    out.push({
      date: p.debut,
      revenus: totalRevenus(etat, p),
      depenses: totalDepenses(etat, p),
      net: beneficeNet(etat, p),
    })
  }
  return out
}

/**
 * Activite par jour de la semaine — lundi en premier, usage francais.
 *
 * La comparaison se fait sur la MOYENNE par journee saisie, pas sur le total.
 * Deux samedis oublies feraient plonger le total du samedi et donneraient a
 * lire un jour creux, alors qu'il s'agit seulement d'une saisie manquante.
 * La moyenne des samedis reellement enregistres reste, elle, representative.
 *
 * `nb` est conserve pour que l'info-bulle puisse dire sur combien de journees
 * repose la moyenne : une moyenne fondee sur un seul samedi ne se lit pas
 * comme une moyenne fondee sur quatre.
 */
export function serieSemaine(etat, periode) {
  const buckets = Array.from({ length: 7 }, (_, i) => ({
    jour: i,
    montant: 0,
    nb: 0,
    moyenne: 0,
  }))
  for (const j of journeesDe(etat, periode)) {
    // getDay() renvoie 0 pour dimanche ; on decale pour commencer au lundi.
    const idx = (depuisCleJour(j.date).getDay() + 6) % 7
    buckets[idx].montant += j.montant
    buckets[idx].nb += 1
  }
  for (const b of buckets) b.moyenne = b.nb > 0 ? b.montant / b.nb : 0
  return buckets
}

/* ==========================================================================
   Previsions
   ========================================================================== */

/**
 * Moyenne et dispersion des recettes, PAR JOUR DE LA SEMAINE.
 *
 * C'est le socle de toutes les previsions, et le detail qui les rend justes :
 * un samedi rapporte ici ~50 % de plus qu'un mardi. Projeter la fin du mois
 * sur une moyenne globale donnerait un chiffre trop bas quand il reste
 * surtout des week-ends, trop haut dans le cas inverse. On projette donc
 * chaque jour restant avec la moyenne de SON jour de la semaine.
 *
 * `ecartType` sert a exprimer une fourchette plutot qu'un chiffre unique :
 * une prevision presentee au gourde pres serait une fausse precision.
 */
export function moyennesParJourSemaine(etat, { semaines = 6, reference = new Date() } = {}) {
  const debut = new Date(reference)
  debut.setDate(debut.getDate() - semaines * 7)
  const periode = creerPeriode(cleJour(debut), cleJour(reference))

  const seaux = Array.from({ length: 7 }, () => [])
  for (const j of journeesDe(etat, periode)) {
    seaux[(depuisCleJour(j.date).getDay() + 6) % 7].push(j.montant)
  }

  return seaux.map((valeurs, jour) => {
    if (valeurs.length === 0) return { jour, moyenne: null, ecartType: 0, nb: 0 }
    const moyenne = valeurs.reduce((t, v) => t + v, 0) / valeurs.length
    const variance =
      valeurs.length > 1
        ? valeurs.reduce((t, v) => t + (v - moyenne) ** 2, 0) / (valeurs.length - 1)
        : 0
    return { jour, moyenne, ecartType: Math.sqrt(variance), nb: valeurs.length }
  })
}

/** Moyenne de repli quand un jour de la semaine n'a aucun historique. */
function moyenneGlobale(profil) {
  const connus = profil.filter((p) => p.moyenne != null)
  if (!connus.length) return null
  const total = connus.reduce((t, p) => t + p.moyenne * p.nb, 0)
  const n = connus.reduce((t, p) => t + p.nb, 0)
  return n > 0 ? total / n : null
}

/**
 * Qualite de la prevision, dite honnetement.
 *
 * Deux choses la degradent : trop peu de journees observees, et une activite
 * trop irreguliere. Annoncer « fiable » sur trois jours d'historique serait
 * trompeur — l'utilisateur prendrait des decisions d'achat sur du vent.
 */
function fiabilite(profil) {
  const connus = profil.filter((p) => p.moyenne != null && p.moyenne > 0)
  const nb = connus.reduce((t, p) => t + p.nb, 0)
  if (nb < 7) return { niveau: 'faible', nb, raison: "moins d'une semaine d'historique" }

  const dispersion =
    connus.reduce((t, p) => t + p.ecartType / p.moyenne, 0) / (connus.length || 1)
  if (nb < 21) return { niveau: 'moyenne', nb, raison: "moins de trois semaines d'historique" }
  if (dispersion > 0.35) return { niveau: 'moyenne', nb, raison: 'activité irrégulière' }
  return { niveau: 'bonne', nb, raison: null }
}

/**
 * Projection de fin de mois.
 *
 * Le realise n'est jamais extrapole : il est ajoute tel quel, et seuls les
 * jours a venir sont estimes. La fourchette couvre environ 80 % des cas —
 * calculee sur la somme des variances des jours restants, pas sur un
 * pourcentage arbitraire.
 */
export function previsionMois(etat, reference = new Date()) {
  const mois = moisCourant(reference)
  const aujourdhui = cleJour(reference)

  const profil = moyennesParJourSemaine(etat, { reference })
  const repli = moyenneGlobale(profil)
  if (repli == null) return null

  const realise = totalRevenus(etat, creerPeriode(mois.debut, aujourdhui))

  // Les jours restants commencent DEMAIN : la journee en cours est deja
  // entamee, l'estimer entierement compterait deux fois ce qui a ete vendu.
  let attendu = 0
  let variance = 0
  const joursRestants = []

  const d = depuisCleJour(aujourdhui)
  d.setDate(d.getDate() + 1)
  const fin = depuisCleJour(mois.fin)

  while (d <= fin) {
    const p = profil[(d.getDay() + 6) % 7]
    const moyenne = p.moyenne ?? repli
    attendu += moyenne
    variance += p.ecartType ** 2
    joursRestants.push({ date: cleJour(d), attendu: moyenne })
    d.setDate(d.getDate() + 1)
  }

  // 1,28 ecart-type de part et d'autre ≈ 80 % des cas.
  const marge = 1.28 * Math.sqrt(variance)
  const total = realise + attendu

  return {
    realise,
    attendu,
    total,
    bas: Math.max(realise, total - marge),
    haut: total + marge,
    joursRestants,
    fiabilite: fiabilite(profil),
    profil,
  }
}

/**
 * Date estimee de rupture de stock, et date a laquelle commander.
 *
 * On consomme le stock jour apres jour au rythme de chaque jour de la
 * semaine, plutot qu'en divisant par une moyenne : une citerne a moitie vide
 * un vendredi ne tient pas le meme nombre de jours qu'un lundi.
 */
export function previsionRupture(etat, reference = new Date(), { delaiCommande = 2 } = {}) {
  const stock = gallonsEnStock(etat)
  const profil = moyennesParJourSemaine(etat, { reference })
  const repli = moyenneGlobale(profil)
  if (repli == null || repli <= 0) return null

  const prix = etat.reglages?.prix_vente_gallon
  if (!prix) return null

  let restant = stock
  const d = new Date(reference)
  let jours = 0
  const PLAFOND = 365 // au-dela, la prevision n'a plus de sens

  while (restant > 0 && jours < PLAFOND) {
    d.setDate(d.getDate() + 1)
    jours++
    const p = profil[(d.getDay() + 6) % 7]
    restant -= (p.moyenne ?? repli) / prix
  }

  if (jours >= PLAFOND) return { stock, jours: null, date: null, dateCommande: null, profil }

  const commande = new Date(d)
  commande.setDate(commande.getDate() - delaiCommande)

  return {
    stock,
    jours,
    date: cleJour(d),
    // Un camion ne se fait pas livrer le jour meme : on recule de quelques
    // jours pour que la commande arrive avant la citerne vide.
    dateCommande: cleJour(commande),
    urgent: jours <= delaiCommande,
    fiabilite: fiabilite(profil),
  }
}

/**
 * Serie pour le graphique de prevision : cumul realise puis cumul projete.
 * Les deux partagent le meme axe et se rejoignent a aujourd'hui, pour que la
 * projection se lise comme la suite de la courbe et non comme une autre.
 */
export function seriePrevision(etat, reference = new Date()) {
  const prev = previsionMois(etat, reference)
  if (!prev) return []

  const mois = moisCourant(reference)
  const aujourdhui = cleJour(reference)

  let cumul = 0
  const points = serieQuotidienne(etat, creerPeriode(mois.debut, aujourdhui)).map((j) => {
    cumul += j.revenus
    return { date: j.date, realise: cumul, projete: null }
  })

  // Le dernier point realise porte aussi la premiere valeur projetee : sans ce
  // recouvrement, les deux courbes seraient separees par un trou.
  if (points.length) points[points.length - 1].projete = cumul

  for (const r of prev.joursRestants) {
    cumul += r.attendu
    points.push({ date: r.date, realise: null, projete: cumul })
  }
  return points
}

/* ==========================================================================
   Mode compteur
   ========================================================================== */

/**
 * Ecart entre ce que le compteur dit avoir ete debite et ce que la caisse a
 * encaisse. N'a de sens que sur une journee dont les gallons ont ete MESURES :
 * en mode estime, les gallons derivent du montant, donc l'ecart serait
 * mecaniquement nul et l'indicateur mensonger.
 *
 * Un ecart negatif signifie qu'il manque de l'argent : remises, dons,
 * ventes a credit, fuite, ou vol.
 */
export function ecartCaisse(journee) {
  if (!journee || journee.gallons_source !== 'compteur') return null
  const attendu = journee.gallons * journee.prix_reference
  const ecart = journee.montant - attendu
  return {
    attendu,
    encaisse: journee.montant,
    ecart,
    prixMoyenReel: journee.gallons > 0 ? journee.montant / journee.gallons : null,
  }
}

/* ==========================================================================
   Utilitaires
   ========================================================================== */

/**
 * Variation en pourcentage entre deux valeurs.
 * Renvoie null si la reference est nulle : « +infini % » n'aide personne.
 */
export function variationPct(actuel, precedent) {
  if (!precedent) return null
  return ((actuel - precedent) / Math.abs(precedent)) * 100
}

/** Journees non encore cloturees entre la premiere activite et hier. */
export function joursNonClotures(etat, reference = new Date()) {
  const js = journeesDe(etat, TOUT)
  const connues = new Set(js.map((j) => j.date))
  const aujourdhui = cleJour(reference)

  // Sans historique, on ne reclame rien : l'app vient d'etre installee.
  if (js.length === 0) return []

  const premiere = js.map((j) => j.date).sort()[0]
  const manquants = []
  const d = depuisCleJour(premiere)
  const fin = new Date(reference)
  while (cleJour(d) < aujourdhui && d <= fin) {
    const cle = cleJour(d)
    if (!connues.has(cle)) manquants.push(cle)
    d.setDate(d.getDate() + 1)
  }
  return manquants
}
