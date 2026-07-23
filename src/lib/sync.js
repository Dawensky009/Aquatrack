/**
 * Synchronisation vers Supabase — processus de fond.
 *
 * Principe : l'interface n'attend JAMAIS ce module. Elle ecrit dans
 * IndexedDB, l'affichage se met a jour, et la synchro se debrouille ensuite.
 * En Haiti le reseau tombe sans prevenir ; une saisie ne doit jamais en
 * dependre.
 *
 * Sens de circulation :
 *   - push : l'outbox alimentee par db.js est videe par lots (upsert)
 *   - pull : on ne redemande que ce qui a change depuis le dernier passage
 *
 * Conflits : last-write-wins sur `updated_at`. Suffisant ici — il y a un
 * seul operateur, donc les conflits reels sont quasi inexistants. Avec
 * plusieurs postes il faudrait davantage.
 */

import { supabase, supabaseConfigure } from './supabase.js'
import { sessionCourante, monKiosque } from './auth.js'
import * as db from './db.js'

const LOT = 50

/** Nombre de refus consecutifs avant de chercher la ligne fautive. */
const SEUIL_ISOLEMENT = 3
const CLE_DERNIER_PULL = 'dernier_pull'

let enCours = false
let minuterie = null

/* ==========================================================================
   Etat expose a l'interface
   ========================================================================== */

export async function etatSync() {
  const enAttente = await db.compterOutbox()
  // Remonte jusqu'a l'interface : une ligne que le serveur refuse ne doit pas
  // disparaitre en silence. Les chiffres restent justes en local, mais la
  // sauvegarde distante est incomplete et l'utilisateur doit le savoir.
  const bloques = await db.compterBloques()

  if (!supabaseConfigure) return { statut: 'local', enAttente, bloques }

  // Dit clairement pourquoi rien ne part, plutot que d'afficher « à jour »
  // alors qu'aucune ligne n'a ete envoyee.
  if (await db.lireMeta(db.CLE_DONNEES_DEMO, false)) {
    return { statut: 'demo', enAttente, bloques }
  }

  // Sans session, l'application reste pleinement utilisable — seule la
  // sauvegarde distante est en pause. L'etat le dit clairement plutot que de
  // laisser croire a une synchro qui n'a pas lieu.
  if (!(await sessionCourante())) return { statut: 'non-connecte', enAttente, bloques }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { statut: 'hors-ligne', enAttente, bloques }
  }

  // Connecte mais pas encore rattache a un kiosque : rien ne peut partir.
  if (!(await monKiosque())) return { statut: 'sans-kiosque', enAttente, bloques }
  if (enCours) return { statut: 'en-cours', enAttente, bloques }
  return { statut: enAttente > 0 ? 'en-attente' : 'a-jour', enAttente, bloques }
}

/* ==========================================================================
   Push
   ========================================================================== */

async function pousser() {
  const entrees = await db.lireOutbox(LOT)
  if (entrees.length === 0) return { pousse: 0 }

  // Regroupe par table : un upsert par table plutot qu'un appel par ligne.
  const parTable = new Map()
  for (const e of entrees) {
    if (!parTable.has(e.table)) parTable.set(e.table, [])
    parTable.get(e.table).push(e)
  }

  let pousse = 0
  let dernierEchec = null

  for (const [table, lot] of parTable) {
    // La derniere version de chaque ligne suffit : inutile de rejouer
    // trois modifications successives du meme enregistrement.
    const parId = new Map()
    for (const e of lot) parId.set(e.row_id, e)
    const derniers = [...parId.values()]

    const { error } = await supabase
      .from(table)
      .upsert(derniers.map((e) => e.payload), { onConflict: 'id' })

    if (!error) {
      await db.retirerOutbox(lot.map((e) => e.seq))
      pousse += derniers.length
      continue
    }

    // On n'enleve rien de l'outbox : la donnee est conservee jusqu'a
    // confirmation. Une synchro ratee ne doit jamais perdre une saisie.
    await db.marquerEchec(lot.map((e) => e.seq))
    dernierEchec = error

    // Une coupure reseau fait echouer le lot entier et se resout seule ; on ne
    // cherche donc un coupable qu'apres plusieurs refus consecutifs.
    const obstines = derniers.filter((e) => (e.attempts ?? 0) + 1 >= SEUIL_ISOLEMENT)
    if (obstines.length === 0 || derniers.length === 0) continue

    await isoler(table, obstines)
    // Les autres tables continuent : c'est tout l'interet de ne plus
    // interrompre la boucle au premier refus.
  }

  return { pousse, erreur: dernierEchec }
}

/**
 * Identifiant d'une categorie VIVANTE de meme nom sur le serveur, ou null.
 * Le select est borne au kiosque par les regles de securite (RLS).
 */
async function categorieDeMemeNom(payload) {
  const nom = (payload?.nom ?? '').trim().toLowerCase()
  if (!nom) return null
  const { data } = await supabase.from('categories').select('id, nom').eq('deleted', false)
  const trouvee = (data ?? []).find(
    (c) => c.id !== payload.id && (c.nom ?? '').trim().toLowerCase() === nom,
  )
  return trouvee?.id ?? null
}

/**
 * Rejoue une a une les lignes obstinees pour distinguer celle qui bloque.
 *
 * Un lot est refuse en bloc par PostgREST : sans ce passage ligne a ligne, une
 * seule saisie malformee condamnerait toutes les autres du meme envoi.
 */
async function isoler(table, entrees) {
  for (const e of entrees) {
    const { error } = await supabase.from(table).upsert([e.payload], { onConflict: 'id' })
    if (!error) {
      await db.retirerOutbox([e.seq])
      continue
    }

    // Une categorie refusee se repare, de deux facons selon la cause.
    if (table === 'categories') {
      // Cas courant : une categorie de MEME NOM existe deja dans le kiosque
      // (l'index unique l'a refusee). On adopte l'existante plutot que
      // d'insister — sinon on renumeroterait a l'infini, le nom restant en
      // conflit. Les depenses du doublon sont rattachees a la survivante.
      const existante = await categorieDeMemeNom(e.payload)
      if (existante && existante !== e.row_id) {
        await db.adopterCategorie(e.row_id, existante)
        console.warn(`[sync] catégorie « ${e.payload?.nom} » fusionnée avec l'existante`)
        continue
      }

      // Cas rare : collision d'identifiant seul (deux kiosques, meme uuid). Un
      // nouvel identifiant suffit.
      const nouvelId = await db.renumeroterCategorie(e.row_id)
      if (nouvelId) {
        console.warn(`[sync] catégorie ${e.row_id} renumérotée en ${nouvelId}`)
        continue
      }
    }

    console.warn(`[sync] ligne isolée (${table}/${e.row_id}) : ${error.message}`)
    await db.bloquerOutbox([e.seq], error.message)
  }
}

/* ==========================================================================
   Pull
   ========================================================================== */

async function tirer() {
  const depuis = (await db.lireMeta(CLE_DERNIER_PULL)) ?? '1970-01-01T00:00:00.000Z'
  let plusRecent = depuis
  let recues = 0

  // Les lignes en attente d'envoi sont protegees : un pull ne doit jamais
  // ecraser une saisie locale que le serveur n'a pas encore recue. Lu une
  // seule fois, apres le push — donc ce qui reste ici a vraiment echoue a
  // partir, ou n'est pas encore parti.
  const idsEnAttente = await db.idsOutboxEnAttente()

  for (const table of db.TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', depuis)
      .order('updated_at', { ascending: true })

    if (error) throw error
    if (!data?.length) continue

    await db.fusionnerDepuisServeur(table, data, idsEnAttente)
    recues += data.length
    const dernier = data[data.length - 1].updated_at
    if (dernier > plusRecent) plusRecent = dernier
  }

  // Le curseur n'avance qu'apres une fusion reussie de TOUTES les tables :
  // une erreur en cours de route doit pouvoir etre rejouee integralement.
  if (plusRecent !== depuis) await db.ecrireMeta(CLE_DERNIER_PULL, plusRecent)

  // C'est ici, et nulle part ailleurs, que les doublons apparaissent : les
  // categories du serveur viennent de rejoindre celles amorcees en local.
  const fusionnees = await db.fusionnerCategoriesHomonymes()
  if (fusionnees > 0) console.info(`[sync] ${fusionnees} catégorie(s) en double fusionnée(s)`)

  return recues + fusionnees
}

/* ==========================================================================
   Images des recus
   ========================================================================== */

export const SEAU_RECUS = 'recus'

/**
 * Televerse les photos de recus vers Supabase Storage.
 *
 * Passe SEPAREE de l'outbox, et volontairement :
 *
 *   - une image pese ~200 Ko contre quelques centaines d'octets pour une
 *     ligne de donnees ; sur une connexion instable, la faire transiter dans
 *     le meme lot bloquerait la synchronisation des chiffres, qui sont
 *     l'essentiel ;
 *   - un echec de televersement ne doit jamais empecher une recette d'arriver
 *     sur le serveur.
 *
 * Cinq images par passage au maximum. Le reste attendra le tour suivant :
 * mieux vaut progresser lentement que saturer un lien deja fragile.
 */
async function televerserRecus(idKiosque) {
  const aFaire = await db.recusATeleverser(5)
  if (!aFaire.length) return

  for (const recu of aFaire) {
    const image = await db.lireImageRecu(recu.id, 'image')
    if (!image) continue

    // Le chemin commence par l'identifiant du KIOSQUE, pas du compte : sinon
    // l'employe ne pourrait pas ouvrir un recu photographie par le
    // proprietaire. C'est aussi ce sur quoi s'appuie la policy de stockage.
    const chemin = `${idKiosque}/${recu.depense_id}/${recu.id}.jpg`
    const { error } = await supabase.storage.from(SEAU_RECUS).upload(chemin, image, {
      contentType: recu.mime || 'image/jpeg',
      upsert: true,
    })

    // On s'arrete au premier echec plutot que d'insister : si le reseau lache,
    // les suivantes echoueront aussi, et chaque tentative coute des donnees.
    if (error) {
      console.warn('[sync] téléversement du reçu impossible :', error.message)
      return
    }
    await db.marquerRecuTeleverse(recu.id, chemin)
  }
}

/**
 * Rapatrie les images de recus presentes sur le serveur mais absentes en local.
 *
 * Le miroir du televersement, et longtemps oublie : sans lui, un recu
 * photographie sur un telephone n'etait JAMAIS visible sur un autre — la fiche
 * arrivait, l'image restait au stockage. L'employe voyait un carre vide, et le
 * proprietaire perdait ses recus des qu'un changement de compte vidait la base
 * locale.
 *
 * Le blob descendu sert a la fois d'original et de vignette : reduire une image
 * cote client demanderait un canvas, et le gain de place ne vaut pas la
 * complexite pour cinq images par cycle.
 */
async function telechargerRecus() {
  const aFaire = await db.recusATelecharger(5)
  if (!aFaire.length) return

  for (const recu of aFaire) {
    const { data, error } = await supabase.storage.from(SEAU_RECUS).download(recu.chemin_distant)
    if (error) {
      // Un recu efface du stockage par un autre appareil laisse une fiche
      // orpheline : on n'insiste pas, et on ne bloque pas les suivants.
      console.warn('[sync] reçu introuvable au stockage :', error.message)
      continue
    }
    await db.enregistrerImageRecu(recu.id, data, data)
  }
}

/**
 * Efface du stockage les photos des recus supprimes.
 *
 * Sans cette passe, supprimer un recu ne liberait jamais la place qu'il occupe
 * sur Supabase : la ligne part en suppression logique, mais l'image reste, et
 * le quota se remplit de photos que plus personne ne peut voir.
 *
 * Comme le televersement, l'operation est bornee et son echec est sans
 * consequence : elle sera retentee au cycle suivant.
 */
async function purgerRecusSupprimes() {
  const aPurger = await db.recusAPurger(5)
  if (!aPurger.length) return

  const chemins = aPurger.map((r) => r.chemin_distant)
  const { error } = await supabase.storage.from(SEAU_RECUS).remove(chemins)
  if (error) {
    console.warn('[sync] purge des reçus impossible :', error.message)
    return
  }
  for (const recu of aPurger) await db.marquerRecuPurge(recu.id)
}

/* ==========================================================================
   Orchestration
   ========================================================================== */

export async function declencherSync() {
  if (!supabaseConfigure) return { statut: 'local' }
  if (enCours) return { statut: 'en-cours' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { statut: 'hors-ligne' }
  }

  // Tant que l'appareil n'a pas fini sa configuration, il ne synchronise
  // rien. La connexion ouvre une session avant que le kiosque ne soit choisi :
  // sans cette garde, une synchro partirait dans cet intervalle, enverrait les
  // categories amorcees d'office et redescendrait celles du kiosque — les deux
  // jeux se retrouveraient cote a cote, et « Camion d'eau » apparaitrait en
  // double. C'est exactement la course que `abandonnerCategoriesParDefaut()`
  // essayait de gagner.
  if (!(await db.lireMeta('appareil_configure', false))) return { statut: 'non-configure' }

  // Rien de fictif ne quitte l'appareil. Une base de demonstration contient
  // soixante jours de chiffres inventes : arrives sur le serveur, ils
  // seraient indiscernables des vrais et il faudrait les demeler un par un.
  if (await db.lireMeta(db.CLE_DONNEES_DEMO, false)) return { statut: 'demo' }

  // Sans session, rien ne part. Les ecritures continuent de s'accumuler dans
  // l'outbox et partiront a la connexion : aucune saisie n'est perdue.
  const session = await sessionCourante()
  if (!session) return { statut: 'non-connecte' }

  // Connecte mais sans kiosque : la valeur par defaut de `kiosque_id` serait
  // nulle et chaque insertion echouerait. On attend que l'utilisateur ait cree
  // ou rejoint un kiosque plutot que d'empiler des echecs.
  const kiosque = await monKiosque()
  if (!kiosque) return { statut: 'sans-kiosque' }

  // Garde-fou : la base locale porte le kiosque auquel elle appartient. Si le
  // compte connecte en sert un autre, on ne touche a RIEN — pousser
  // deverserait la comptabilite d'un kiosque dans celle d'un autre, et tirer
  // melangerait les deux. Le cas est normalement traite a la configuration ;
  // ceci le rattrape si l'appartenance a change entre-temps.
  const local = await db.lireMeta(db.CLE_KIOSQUE_LOCAL, null)
  if (!local) {
    await db.ecrireMeta(db.CLE_KIOSQUE_LOCAL, kiosque.id)
  } else if (local !== kiosque.id) {
    console.warn('[sync] données locales d’un autre kiosque — synchro suspendue')
    return { statut: 'kiosque-different' }
  }

  enCours = true
  try {
    // Le push ne leve plus : un refus sur une table ne doit pas empecher le
    // pull, qui est en lecture seule et parfaitement independant. Priver
    // l'appareil des donnees du serveur parce qu'il n'a pas su envoyer les
    // siennes n'aidait personne.
    const { erreur: erreurPush } = await pousser()
    const modifie = (await tirer()) > 0
    // Les images passent en dernier, et leur echec ne remonte pas : les
    // chiffres sont deja sauvegardes, c'est ce qui compte.
    await televerserRecus(kiosque.id).catch((e) =>
      console.warn('[sync] reçus non téléversés :', e.message),
    )
    await telechargerRecus().catch((e) =>
      console.warn('[sync] reçus non téléchargés :', e.message),
    )
    await purgerRecusSupprimes().catch((e) =>
      console.warn('[sync] reçus non purgés :', e.message),
    )
    if (erreurPush) {
      console.warn('[sync] envoi incomplet, nouvelle tentative :', erreurPush.message)
      return { statut: 'erreur', erreur: erreurPush, modifie }
    }
    return { statut: 'a-jour', modifie }
  } catch (erreur) {
    // Volontairement silencieux cote UI : une synchro qui echoue n'est pas
    // une erreur pour l'utilisateur, ses donnees sont saines en local.
    // Le badge passera simplement a « N en attente ».
    console.warn('[sync] echec, nouvelle tentative plus tard :', erreur.message)
    return { statut: 'erreur', erreur }
  } finally {
    enCours = false
  }
}

/**
 * Demarre la boucle de fond : au retour du reseau, et toutes les 60 s.
 * Renvoie une fonction d'arret.
 */
export function demarrerSync(surChangement = () => {}) {
  if (!supabaseConfigure) return () => {}

  const tenter = async () => {
    // Le resultat porte `modifie` : sans le transmettre, les donnees
    // descendues du serveur resteraient invisibles jusqu'au prochain
    // redemarrage de l'application.
    const resultat = await declencherSync()
    surChangement(await etatSync(), resultat)
  }

  const auRetourReseau = () => tenter()
  window.addEventListener('online', auRetourReseau)
  window.addEventListener('offline', async () => surChangement(await etatSync()))
  minuterie = setInterval(tenter, 60_000)
  tenter()

  return () => {
    window.removeEventListener('online', auRetourReseau)
    clearInterval(minuterie)
  }
}
