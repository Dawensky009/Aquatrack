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
import { cleJour } from '../lib/format.js'
import { sessionCourante, membresKiosque, monKiosque } from '../lib/auth.js'
import { supabaseConfigure } from '../lib/supabase.js'

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

/**
 * Le filet de securite « aucune categorie » n'a le droit de semer qu'UNE fois
 * par session. Au-dela, c'est le signe d'une boucle, pas d'un manque : mieux
 * vaut s'arreter que gonfler la table de categories a chaque cycle.
 */
let filetTire = false

/**
 * Masquage des montants — preference d'appareil, dans localStorage.
 *
 * Ni dans les reglages synchronises ni dans IndexedDB : c'est un choix de
 * DISCRETION propre a ce telephone (le cacher sur le mien ne doit pas le cacher
 * sur celui de l'employe), et il doit s'appliquer avant meme le premier rendu,
 * sans attendre une lecture asynchrone de la base.
 */
const CLE_MASQUE = 'aqua-montants-caches'
const lireMasque = () => {
  try {
    return localStorage.getItem(CLE_MASQUE) === '1'
  } catch {
    return false
  }
}

/** Noms qui ne designent personne, et qu'on remplace des qu'on sait mieux. */
const NOMS_IMPERSONNELS = new Set(['', 'Administrateur'])

/**
 * Retrouve un nom presentable pour la personne connectee.
 *
 * Deux sources, dans cet ordre : celui inscrit sur sa fiche de membre — donc
 * saisi lors de l'entree dans le kiosque, y compris depuis un autre appareil
 * — puis, a defaut, la partie gauche de son email. Un « Administrateur »
 * generique ne dit rien a personne.
 */
async function nomDepuisCompte() {
  try {
    const session = await sessionCourante()
    if (!session?.user) return ''

    const membres = await membresKiosque()
    const moi = membres.find((m) => m.user_id === session.user.id)
    if (moi?.nom?.trim()) return moi.nom.trim()

    const local = (session.user.email ?? '').split('@')[0]
    if (!local) return ''
    return local.charAt(0).toUpperCase() + local.slice(1)
  } catch {
    // Serveur injoignable : on garde le nom deja en place.
    return ''
  }
}

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

  /* --- Compte -------------------------------------------------------------
     `null` signifie « pas connecte », ce qui est un etat parfaitement normal :
     l'application fonctionne integralement sans compte. */
  session: null,

  /**
   * L'appareil a-t-il deja ete configure une fois ?
   *
   * C'est ce drapeau qui rend l'application utilisable hors-ligne. La
   * connexion est exigee a la PREMIERE ouverture seulement ; ensuite l'app
   * s'ouvre sans reseau, indefiniment, meme si le jeton ne peut plus etre
   * rafraichi. Exiger une session valide a chaque lancement rendrait
   * l'application inutilisable un soir de coupure — et la recette du jour
   * serait perdue.
   */
  appareilConfigure: true, // valeur sure : on ne bloque pas avant d'avoir lu

  /* --- Discretion : masquer les montants --------------------------------
     Pour ne pas exposer ses chiffres a qui jette un oeil sur le comptoir. */
  montantsCaches: lireMasque(),

  basculerMontants() {
    const valeur = !get().montantsCaches
    try {
      localStorage.setItem(CLE_MASQUE, valeur ? '1' : '0')
    } catch {
      /* stockage indisponible : le choix ne survivra pas au rechargement, tant pis */
    }
    set({ montantsCaches: valeur })
  },

  majSession(session) {
    set({ session })
    // Une connexion doit declencher l'envoi de tout ce qui attend, sans que
    // l'utilisateur ait a patienter jusqu'au prochain cycle de 60 s.
    get().apresEcriture()
  },

  /**
   * Appelee quand compte ET kiosque sont en place.
   *
   * `rejoint` distingue les deux cas : celui qui CREE son kiosque garde ses
   * categories, celui qui REJOINT celui d'un autre abandonne les siennes et
   * recevra celles du kiosque. Sans cela l'employe verrait « Camion d'eau »
   * en double des la premiere synchronisation.
   */
  async terminerConfiguration({ rejoint = false, monNom = '' } = {}) {
    // Si cet appareil servait un AUTRE kiosque, sa base est videe ici. C'est
    // ce qui garantit qu'un compte neuf ouvre un tableau de bord vide, et non
    // les chiffres de la personne qui utilisait le telephone avant lui.
    // Une base de demonstration est jetee avant tout rattachement : on entre
    // dans un vrai kiosque avec une comptabilite vide, jamais avec soixante
    // jours de chiffres inventes.
    const etaitDemo = await db.lireMeta(db.CLE_DONNEES_DEMO, false)
    if (etaitDemo) {
      await db.toutEffacer()
      await db.ecrireMeta(db.CLE_DONNEES_DEMO, false)
      await db.ecrireMeta('dernier_pull', null)
    }

    const kiosque = await monKiosque().catch(() => null)
    const changeDeKiosque = kiosque ? await db.rattacherAuKiosque(kiosque.id) : false

    if (changeDeKiosque || etaitDemo) {
      // La base est vide. Celui qui CREE un kiosque a besoin de ses categories
      // de depart ; celui qui en REJOINT un recevra celles du kiosque, et les
      // amorcer ferait doublon.
      if (!rejoint) await db.amorcerCategories()
    } else if (rejoint) {
      await db.abandonnerCategoriesParDefaut()
    }

    // Le nom saisi devient celui qui salue sur l'accueil. S'il est vide — cas
    // de l'etape franchie automatiquement — on va le chercher aupres du
    // kiosque, ou a defaut on derive l'email : « Administrateur » ne dit rien
    // a personne.
    const nom = monNom || (await nomDepuisCompte())
    if (nom) await get().majReglages({ nom_utilisateur: nom })

    await db.ecrireMeta('appareil_configure', true)
    set({ appareilConfigure: true })
    await get().recharger()
    get().apresEcriture()
  },

  /* --- Interface : la feuille de saisie --------------------------------- */
  feuille: null, // null | { type: 'cloture' | 'depense' | 'choix', donnees? }

  ouvrirFeuille: (type, donnees = null) => set({ feuille: { type, donnees } }),
  fermerFeuille: () => set({ feuille: null }),

  /* --- Interface : periode consultee ------------------------------------
     Volontairement en memoire et non persistee : on rouvre l'app pour voir
     le mois en cours, pas la periode qu'on consultait la semaine derniere. */
  periode: 'mois', // 'mois' | 'precedent' | '30j' | 'tout'
  choisirPeriode: (periode) => set({ periode }),

  /* --- Rappel de cloture --------------------------------------------------
     Jour ou l'utilisateur a ecarte la banniere, pour qu'elle se taise jusqu'au
     lendemain. Lu au demarrage depuis `meta`, non synchronise. */
  rappelRejetLe: null,

  /** Ecarte la banniere de rappel jusqu'au lendemain. */
  async rejeterRappel() {
    const cle = cleJour(new Date())
    await db.ecrireMeta('rappel_dernier_rejet', cle)
    set({ rappelRejetLe: cle })
  },

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

      // Donnees de demonstration : EN DEVELOPPEMENT UNIQUEMENT.
      //
      // Elles sont utiles pour travailler sur les ecrans, mais desastreuses en
      // production : chaque personne ouvrant l'application y verrait 60 jours
      // de recettes inventees. Un employe croirait a de vrais chiffres, et le
      // proprietaire devrait nettoyer chaque appareil un par un.
      //
      // En production, on demarre donc a vide — les ecrans ont tous un etat
      // vide qui explique quoi faire — et la demonstration reste disponible a
      // la demande depuis Reglages.
      const dejaAmorce = await db.lireMeta('demo_generee', false)
      if (import.meta.env.DEV && !dejaAmorce && (await db.estVierge())) {
        await genererDemo()
        await db.ecrireMeta(db.CLE_DONNEES_DEMO, true)
      }
      // Marque pose dans tous les cas : une base volontairement videe ne doit
      // pas se repeupler toute seule au rechargement suivant.
      await db.ecrireMeta('demo_generee', true)

      // Reprise des identifiants hérités : sans elle, une base créée avant la
      // correction ne pourrait jamais se synchroniser.
      await db.migrerIdentifiants()

      // La session est lue avant de rendre l'app : sans cela, le badge
      // afficherait « Hors sauvegarde » une fraction de seconde a chaque
      // ouverture, alors que le compte est bien actif.
      const session = await sessionCourante()

      // L'appareil est repute configure si le drapeau est pose, si une session
      // existe deja (utilisateur connecte avant l'ajout de cet ecran), ou si
      // Supabase n'est pas configure du tout — dans ce dernier cas il n'y a
      // aucun compte a demander, et bloquer serait absurde.
      let configure = await db.lireMeta('appareil_configure', false)
      if (!configure && (session || !supabaseConfigure)) {
        configure = true
        await db.ecrireMeta('appareil_configure', true)
      }

      const rappelRejetLe = await db.lireMeta('rappel_dernier_rejet', null)
      set({ session, appareilConfigure: configure, rappelRejetLe })

      await get().recharger()
      set({ pret: true })
      get().evaluerVerrou()
      get().rafraichirSync()

      // « Administrateur » etait un nom par defaut invente, que personne
      // n'avait choisi. On le remplace des qu'un vrai nom est connu — sans
      // bloquer l'affichage, et sans jamais ecraser un nom saisi a la main.
      if (NOMS_IMPERSONNELS.has((get().reglages.nom_utilisateur ?? '').trim())) {
        nomDepuisCompte().then((nom) => {
          if (nom) get().majReglages({ nom_utilisateur: nom })
        })
      }

      declencherSync().then((r) => get().apresSync(r))
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

  /** Supprime une depense avec les recus qui la justifient. */
  async supprimerDepense(id) {
    await db.supprimerDepense(id)
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
    declencherSync().then((r) => get().apresSync(r))
  },

  /**
   * Prend acte du resultat d'une synchro.
   *
   * Recharge les donnees si le serveur en a renvoye : sans cela, ce qui a ete
   * saisi sur l'autre telephone — ou les categories du kiosque qu'on vient de
   * rejoindre — n'apparaitrait qu'au redemarrage suivant de l'application.
   */
  /**
   * Synchronisation a la demande, depuis le badge.
   *
   * Utile quand on n'a pas la patience d'attendre le cycle de 60 s : au retour
   * du reseau, ou pour recuperer tout de suite la saisie d'un autre appareil.
   * Un etat « en-cours » optimiste donne un retour immediat au doigt ; la
   * synchro reelle corrige ensuite le badge — y compris si elle echoue (le
   * badge repasse alors a « Hors sauvegarde », un « j'ai essaye » honnete).
   */
  async synchroniserMaintenant() {
    if (get().sync.statut === 'en-cours') return
    set({ sync: { ...get().sync, statut: 'en-cours' } })
    const resultat = await declencherSync()
    await get().apresSync(resultat)
  },

  async apresSync(resultat) {
    if (resultat?.modifie) await get().recharger()

    // Filet de securite : un appareil ne doit JAMAIS se retrouver sans aucune
    // categorie — il deviendrait impossible d'enregistrer une depense.
    //
    // Le cas se produit quand on abandonne les categories amorcees d'office
    // pour recevoir celles du kiosque, et que le kiosque n'en a aucune : rien
    // ne remplace ce qu'on vient de jeter.
    //
    // UNE SEULE FOIS par session (`filetTire`) : sans ce verrou, un etat ou
    // les categories restent a zero relancerait la synchro sans fin, et chaque
    // passage semait de nouvelles categories — d'ou une table qui enflait.
    if (get().categories.length === 0 && !filetTire) {
      filetTire = true
      await db.amorcerCategories()
      await get().recharger()
      get().apresEcriture()
      return
    }

    get().rafraichirSync()
  },

  /* --- Donnees de demonstration ----------------------------------------- */

  async reinitialiserDemo() {
    await db.toutEffacer()
    await genererDemo()
    await db.ecrireMeta('demo_generee', true)
    // Marque la base comme FICTIVE. Tant qu'elle l'est, plus rien ne part vers
    // le serveur : soixante jours de chiffres inventes n'ont rien a faire dans
    // la comptabilite d'un vrai kiosque.
    await db.ecrireMeta(db.CLE_DONNEES_DEMO, true)
    await get().recharger()
    get().rafraichirSync()
  },

  async viderTout() {
    await db.toutEffacer()
    await db.amorcerCategories()
    await db.ecrireMeta('demo_generee', true)
    await db.ecrireMeta(db.CLE_DONNEES_DEMO, false)
    await get().recharger()
    get().apresEcriture()
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
