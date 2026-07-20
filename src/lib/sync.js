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
import * as db from './db.js'

const LOT = 50
const CLE_DERNIER_PULL = 'dernier_pull'

let enCours = false
let minuterie = null

/* ==========================================================================
   Etat expose a l'interface
   ========================================================================== */

export async function etatSync() {
  const enAttente = await db.compterOutbox()

  if (!supabaseConfigure) return { statut: 'local', enAttente }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { statut: 'hors-ligne', enAttente }
  }
  if (enCours) return { statut: 'en-cours', enAttente }
  return { statut: enAttente > 0 ? 'en-attente' : 'a-jour', enAttente }
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
  for (const [table, lot] of parTable) {
    // La derniere version de chaque ligne suffit : inutile de rejouer
    // trois modifications successives du meme enregistrement.
    const parId = new Map()
    for (const e of lot) parId.set(e.row_id, e)
    const lignes = [...parId.values()].map((e) => e.payload)

    const { error } = await supabase.from(table).upsert(lignes, { onConflict: 'id' })

    if (error) {
      // On n'enleve rien de l'outbox : la donnee est conservee jusqu'a
      // confirmation. Une synchro ratee ne doit jamais perdre une saisie.
      await db.marquerEchec(lot.map((e) => e.seq))
      throw error
    }
    await db.retirerOutbox(lot.map((e) => e.seq))
    pousse += lignes.length
  }
  return { pousse }
}

/* ==========================================================================
   Pull
   ========================================================================== */

async function tirer() {
  const depuis = (await db.lireMeta(CLE_DERNIER_PULL)) ?? '1970-01-01T00:00:00.000Z'
  let plusRecent = depuis

  for (const table of db.TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', depuis)
      .order('updated_at', { ascending: true })

    if (error) throw error
    if (!data?.length) continue

    await db.fusionnerDepuisServeur(table, data)
    const dernier = data[data.length - 1].updated_at
    if (dernier > plusRecent) plusRecent = dernier
  }

  // Le curseur n'avance qu'apres une fusion reussie de TOUTES les tables :
  // une erreur en cours de route doit pouvoir etre rejouee integralement.
  if (plusRecent !== depuis) await db.ecrireMeta(CLE_DERNIER_PULL, plusRecent)
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
async function televerserRecus() {
  const aFaire = await db.recusATeleverser(5)
  if (!aFaire.length) return

  for (const recu of aFaire) {
    const image = await db.lireImageRecu(recu.id, 'image')
    if (!image) continue

    const chemin = `${recu.depense_id}/${recu.id}.jpg`
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

/* ==========================================================================
   Orchestration
   ========================================================================== */

export async function declencherSync() {
  if (!supabaseConfigure) return { statut: 'local' }
  if (enCours) return { statut: 'en-cours' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { statut: 'hors-ligne' }
  }

  enCours = true
  try {
    await pousser()
    await tirer()
    // Les images passent en dernier, et leur echec ne remonte pas : les
    // chiffres sont deja sauvegardes, c'est ce qui compte.
    await televerserRecus().catch((e) =>
      console.warn('[sync] reçus non téléversés :', e.message),
    )
    return { statut: 'a-jour' }
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
    await declencherSync()
    surChangement(await etatSync())
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
