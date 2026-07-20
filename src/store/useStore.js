/**
 * Etat applicatif — Zustand.
 *
 * Le store expose les donnees exactement dans la forme attendue par
 * lib/metrics.js ({ journees, depenses, categories, reglages }), ce qui
 * permet aux ecrans d'appeler les calculs metier directement sur `etat`
 * sans couche d'adaptation.
 *
 * Toutes les actions ecrivent dans IndexedDB PUIS rechargent l'etat. Le
 * volume est minuscule (une ligne par jour) : recharger est instantane et
 * garantit que l'affichage ne peut jamais diverger de la base.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import * as db from '../lib/db.js'
import { genererDemo } from '../lib/seed.js'
import { declencherSync, etatSync } from '../lib/sync.js'
import * as theme from '../lib/theme.js'
import { importerFichier } from '../lib/echange.js'
import { preparerCode, doitVerrouiller } from '../lib/verrou.js'

/**
 * Verrou d'initialisation.
 *
 * React StrictMode invoque deux fois les effets en developpement, et les deux
 * appels partent avant que le premier n'ait fini d'ecrire : le test « la base
 * est-elle vierge ? » repond oui aux deux, et la demonstration est generee en
 * double. Les journees s'en tirent — leur date est unique — mais les depenses
 * seraient dupliquees, ce qui doublerait silencieusement le stock.
 *
 * On memorise donc la promesse plutot qu'un booleen : le second appel attend
 * le premier au lieu de le doubler.
 */
let promesseInit = null

/**
 * Instant de mise en arriere-plan, hors du store : c'est un fait technique,
 * pas un etat d'interface, et le stocker dans le store declencherait un rendu
 * a chaque bascule d'onglet.
 *
 * `null` signifie « demarrage a froid » — et un demarrage a froid verrouille
 * toujours, quel que soit le delai choisi.
 */
let masqueDepuis = null

export const useStore = create((set, get) => ({
  /* --- Donnees ---------------------------------------------------------- */
  journees: [],
  depenses: [],
  categories: [],
  recus: [],
  reglages: db.REGLAGES_DEFAUT,
  pret: false,

  /* --- Synchronisation -------------------------------------------------- */
  sync: { statut: 'local', enAttente: 0 },

  /* --- Interface : la feuille de saisie --------------------------------- */
  feuille: null, // null | { type: 'cloture' | 'depense' | 'choix', donnees? }

  ouvrirFeuille: (type, donnees = null) => set({ feuille: { type, donnees } }),
  fermerFeuille: () => set({ feuille: null }),

  /* --- Interface : periode consultee ------------------------------------
     Volontairement en memoire et non persistee : on rouvre l'app pour voir
     le mois en cours, pas la periode qu'on consultait la semaine derniere. */
  periode: 'mois', // 'mois' | 'precedent' | '30j' | 'tout'
  choisirPeriode: (periode) => set({ periode }),

  /* --- Verrouillage -------------------------------------------------------
     `verrouille` demarre a `null` : ni verrouille ni ouvert, tant qu'on n'a
     pas lu les reglages. Demarrer a `false` laisserait entrevoir les chiffres
     une fraction de seconde avant que le verrou ne s'applique. */
  verrouille: null,

  deverrouiller() {
    masqueDepuis = null
    set({ verrouille: false })
  },

  /** Appelee au retour au premier plan et au demarrage. */
  evaluerVerrou() {
    const { reglages, verrouille } = get()
    if (!reglages.verrou_actif || !reglages.verrou_empreinte) {
      if (verrouille !== false) set({ verrouille: false })
      return
    }
    if (verrouille) return
    if (doitVerrouiller(reglages.verrou_delai, masqueDepuis)) set({ verrouille: true })
  },

  /** Enregistre l'instant de mise en arriere-plan. */
  applicationMasquee() {
    masqueDepuis = Date.now()
  },

  async definirCode(code) {
    const { sel, empreinte } = await preparerCode(code)
    await get().majReglages({ verrou_actif: true, verrou_sel: sel, verrou_empreinte: empreinte })
  },

  async retirerVerrou() {
    await get().majReglages({
      verrou_actif: false,
      verrou_sel: null,
      verrou_empreinte: null,
      verrou_biometrie: null,
    })
    set({ verrouille: false })
  },

  /* --- Interface : theme ------------------------------------------------- */
  themeMode: theme.lireMode(),
  themeResolu: theme.resoudre(),

  changerTheme(mode) {
    set({ themeMode: mode, themeResolu: theme.ecrireMode(mode) })
  },
  /** Appelee quand le systeme change de theme, en mode « system ». */
  themeSystemeChange(resolu) {
    set({ themeResolu: resolu })
  },

  /* --- Cycle de vie ----------------------------------------------------- */

  initialiser() {
    promesseInit ??= (async () => {
      await db.amorcerCategories()

      // Premier lancement : on peuple avec une demonstration credible plutot
      // que d'accueillir l'utilisateur par cinq ecrans vides.
      const dejaAmorce = await db.lireMeta('demo_generee', false)
      if (!dejaAmorce && (await db.estVierge())) {
        await genererDemo()
      }
      // Marque pose dans tous les cas : une base volontairement videe ne doit
      // pas se repeupler toute seule au rechargement suivant.
      await db.ecrireMeta('demo_generee', true)

      await get().recharger()
      set({ pret: true })
      get().evaluerVerrou()
      get().rafraichirSync()
      declencherSync().then(() => get().rafraichirSync())
    })()
    return promesseInit
  },

  async recharger() {
    const etat = await db.chargerTout()
    set(etat)
  },

  async rafraichirSync() {
    set({ sync: await etatSync() })
  },

  /* --- Ecritures -------------------------------------------------------- */

  async cloturerJour(saisie) {
    await db.enregistrerJournee(saisie)
    await get().recharger()
    get().apresEcriture()
  },

  async ajouterDepense(saisie) {
    await db.enregistrerDepense(saisie)
    await get().recharger()
    get().apresEcriture()
  },

  async supprimerLigne(table, id) {
    await db.supprimer(table, id)
    await get().recharger()
    get().apresEcriture()
  },

  async enregistrerCategorie(categorie) {
    await db.enregistrerCategorie(categorie)
    await get().recharger()
    get().apresEcriture()
  },

  async reordonnerCategories(ordre) {
    // Garde-fou : un tableau vide ou troue effacerait les positions de toutes
    // les categories. Mieux vaut ne rien faire que de corrompre l'ordre.
    if (!Array.isArray(ordre) || ordre.some((c) => !c?.id)) return
    // L'affichage suit le doigt immediatement ; l'ecriture en base rattrape
    // ensuite. Attendre IndexedDB ferait revenir la ligne a sa place le temps
    // du rechargement, et le glissement paraitrait avoir echoue.
    set({ categories: ordre.map((c, position) => ({ ...c, position })) })
    await db.reordonnerCategories(ordre.map((c) => c.id))
    await get().recharger()
    get().apresEcriture()
  },

  async majReglages(partiel) {
    const reglages = await db.ecrireReglages(partiel)
    set({ reglages })
  },

  /** Tente une synchro apres chaque ecriture, sans jamais bloquer l'UI. */
  apresEcriture() {
    get().rafraichirSync()
    declencherSync().then(() => get().rafraichirSync())
  },

  /* --- Donnees de demonstration ----------------------------------------- */

  async reinitialiserDemo() {
    await db.toutEffacer()
    await genererDemo()
    await db.ecrireMeta('demo_generee', true)
    await get().recharger()
  },

  async viderTout() {
    await db.toutEffacer()
    await db.amorcerCategories()
    await db.ecrireMeta('demo_generee', true)
    await get().recharger()
  },

  /** Accepte un fichier JSON ou CSV — le format est reconnu a la lecture. */
  async importer(fichier) {
    const resultat = await importerFichier(fichier)
    await get().recharger()
    get().apresEcriture()
    return resultat
  },
}))

/**
 * L'etat sous la forme attendue par lib/metrics.js.
 *
 * `useShallow` est indispensable ici : le selecteur construit un nouvel objet
 * a chaque appel, et sans comparaison superficielle Zustand considererait
 * l'etat comme modifie a chaque rendu — boucle de rendu infinie garantie.
 */
export const useEtat = () =>
  useStore(
    useShallow((s) => ({
      journees: s.journees,
      depenses: s.depenses,
      categories: s.categories,
      recus: s.recus,
      reglages: s.reglages,
    })),
  )

/** Vrai si le theme sombre est actif — pour transposer les couleurs de donnees. */
export const useSombre = () => useStore((s) => s.themeResolu === 'dark')
