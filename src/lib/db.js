/**
 * Persistance locale — IndexedDB via `idb`.
 *
 * C'est la SOURCE DE VERITE de l'application. L'interface n'ecrit jamais
 * ailleurs, et ne parle jamais directement a Supabase : la synchronisation
 * (lib/sync.js) est un processus de fond qui lit l'outbox alimentee ici.
 *
 * Consequence directe : l'app fonctionne integralement hors-ligne, ce qui
 * n'est pas un confort mais une necessite — on encaisse au comptoir, souvent
 * sans reseau.
 *
 * Chaque ecriture met a jour la donnee ET pousse une entree dans `outbox`
 * DANS LA MEME TRANSACTION. Si le navigateur est tue entre les deux, aucune
 * modification ne peut se retrouver enregistree localement sans etre un jour
 * synchronisee.
 */

import { openDB } from 'idb'
import { cleJour } from './format.js'

export const NOM_APPLICATION = 'Aqua Track'

/**
 * Noms acceptes a l'import.
 *
 * L'ancien nom reste valide : une sauvegarde faite avant le changement de nom
 * doit continuer a se restaurer. Refuser un fichier pour cette seule raison
 * serait perdre des donnees pour une question de marque.
 */
const NOMS_ACCEPTES = [NOM_APPLICATION, 'KiosqueEau Tracker']

/**
 * Le nom de la base ne change PAS avec celui de l'application : le renommer
 * creerait une base vide a cote de l'ancienne, et l'utilisateur retrouverait
 * une application vierge apres une simple mise a jour.
 */
const NOM_BASE = 'kiosque-eau'
const VERSION = 2

/** Tables synchronisees vers Supabase. Les images en sont exclues : elles
 *  relevent du stockage de fichiers, pas de la base de donnees. */
export const TABLES = ['journees', 'depenses', 'categories', 'recus']

let promesseBase = null

function base() {
  if (!promesseBase) {
    promesseBase = openDB(NOM_BASE, VERSION, {
      upgrade(db, ancienneVersion) {
        if (ancienneVersion < 1) {
          // Une seule cloture par jour : `date` est une cle naturelle unique.
          // La contrainte est portee par la base, pas seulement par l'UI.
          const journees = db.createObjectStore('journees', { keyPath: 'id' })
          journees.createIndex('date', 'date', { unique: true })

          const depenses = db.createObjectStore('depenses', { keyPath: 'id' })
          depenses.createIndex('occurred_at', 'occurred_at')

          db.createObjectStore('categories', { keyPath: 'id' })
          db.createObjectStore('reglages', { keyPath: 'cle' })
          db.createObjectStore('meta', { keyPath: 'cle' })
          db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
        }

        if (ancienneVersion < 2) {
          // Les recus sont scindes en DEUX magasins :
          //
          //   - `recus`        : metadonnees legeres (quelques octets par ligne)
          //   - `recus_images` : les blobs, plusieurs centaines de Ko chacun
          //
          // chargerTout() ne lit que les metadonnees. Sans cette separation,
          // chaque rafraichissement de l'etat chargerait tous les recus en
          // memoire — plusieurs Mo a chaque saisie.
          const recus = db.createObjectStore('recus', { keyPath: 'id' })
          recus.createIndex('depense_id', 'depense_id')
          db.createObjectStore('recus_images', { keyPath: 'id' })
        }
      },
    })
  }
  return promesseBase
}

const maintenant = () => new Date().toISOString()

/* ==========================================================================
   Reglages
   ========================================================================== */

export const REGLAGES_DEFAUT = {
  prix_vente_gallon: 25,
  capacite_camion: 1200,
  compteur_actif: false,
  compteur_index_initial: null,
  nom_utilisateur: 'Administrateur',

  // Verrouillage. Le code lui-meme n'est jamais stocke : seule son empreinte
  // PBKDF2 et le sel qui l'accompagne. Ces champs restent LOCAUX — `reglages`
  // ne fait pas partie des tables synchronisees.
  verrou_actif: false,
  verrou_delai: '1m',
  verrou_sel: null,
  verrou_empreinte: null,
  verrou_biometrie: null,
}

export async function lireReglages() {
  const db = await base()
  const lignes = await db.getAll('reglages')
  const stockes = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]))
  return { ...REGLAGES_DEFAUT, ...stockes }
}

export async function ecrireReglages(partiel) {
  const db = await base()
  const tx = db.transaction('reglages', 'readwrite')
  for (const [cle, valeur] of Object.entries(partiel)) {
    await tx.store.put({ cle, valeur })
  }
  await tx.done
  return lireReglages()
}

/* ==========================================================================
   Meta (etat interne : derniere synchro, splash vu, etc.)
   ========================================================================== */

export async function lireMeta(cle, defaut = null) {
  const db = await base()
  const l = await db.get('meta', cle)
  return l ? l.valeur : defaut
}

export async function ecrireMeta(cle, valeur) {
  const db = await base()
  await db.put('meta', { cle, valeur })
}

/* ==========================================================================
   Lecture
   ========================================================================== */

/** Charge tout l'etat en memoire. Le volume reste minuscule : une ligne par
 *  jour et quelques depenses par mois — quelques milliers de lignes apres
 *  des annees d'exploitation. */
export async function chargerTout() {
  const db = await base()
  const [journees, depenses, categories, recus, reglages] = await Promise.all([
    db.getAll('journees'),
    db.getAll('depenses'),
    db.getAll('categories'),
    // Metadonnees seulement : les images restent sur disque jusqu'a ce qu'on
    // les ouvre.
    db.getAll('recus'),
    lireReglages(),
  ])
  return {
    journees: journees.filter((j) => !j.deleted),
    depenses: depenses.filter((d) => !d.deleted),
    categories: categories.filter((c) => !c.deleted).sort((a, b) => a.position - b.position),
    recus: recus.filter((r) => !r.deleted),
    reglages,
  }
}

export async function journeeDuJour(date) {
  const db = await base()
  const j = await db.getFromIndex('journees', 'date', date)
  return j && !j.deleted ? j : null
}

/* ==========================================================================
   Ecriture — donnee + outbox dans la meme transaction
   ========================================================================== */

async function ecrire(table, ligne) {
  const db = await base()
  const tx = db.transaction([table, 'outbox'], 'readwrite')
  await tx.objectStore(table).put(ligne)
  await tx.objectStore('outbox').add({
    table,
    row_id: ligne.id,
    payload: ligne,
    attempts: 0,
    cree_le: maintenant(),
  })
  await tx.done
  return ligne
}

/**
 * Cloture d'une journee.
 *
 * `gallons` et `prix_reference` sont FIGES ici, jamais recalcules a
 * l'affichage. C'est ce qui garantit qu'une modification ulterieure du prix
 * de vente ne reecrira pas retroactivement l'historique.
 *
 * Si la journee existe deja, elle est mise a jour — jamais dupliquee.
 */
export async function enregistrerJournee({
  date,
  montant,
  moncash = 0,
  gallons,
  gallons_source = 'estime',
  releve_compteur = null,
  prix_reference,
  note = '',
}) {
  const existante = await journeeDuJour(date)
  const ligne = {
    id: existante?.id ?? crypto.randomUUID(),
    date,
    montant,
    moncash,
    gallons,
    gallons_source,
    releve_compteur,
    prix_reference,
    note,
    updated_at: maintenant(),
    deleted: false,
  }
  return ecrire('journees', ligne)
}

export async function enregistrerDepense({
  id,
  occurred_at,
  recorded_at,
  category_id,
  designation = '',
  quantity = null,
  total,
  entry_mode = null,
  payment_method = 'cash',
  note = '',
}) {
  const ligne = {
    id: id ?? crypto.randomUUID(),
    occurred_at,
    // Conservee a la modification : ce champ dit quand la ligne a ete saisie
    // POUR LA PREMIERE FOIS. L'ecraser a chaque correction lui ferait perdre
    // sa seule utilite — comprendre un historique incoherent.
    recorded_at: recorded_at ?? maintenant(),
    category_id,
    // Ce qui a ete achete : « Bouchons », « Pompe », « Filtre »... Sert de
    // libelle dans le journal, ou le nom de la categorie serait trop vague
    // pour retrouver une depense parmi douze « Achat materiel ».
    designation,
    quantity,
    // Toujours derive : peu importe que la saisie ait ete faite au forfait
    // camion ou au prix au gallon, la ligne stockee est identique et
    // l'historique des prix reste comparable.
    unit_price: quantity > 0 ? total / quantity : null,
    total,
    entry_mode,
    payment_method,
    note,
    updated_at: maintenant(),
    deleted: false,
  }
  return ecrire('depenses', ligne)
}

export async function enregistrerCategorie(categorie) {
  const ligne = {
    id: categorie.id ?? crypto.randomUUID(),
    nom: categorie.nom,
    color: categorie.color,
    unit: categorie.unit ?? 'montant',
    suit_gallons: !!categorie.suit_gallons,
    position: categorie.position ?? 0,
    updated_at: maintenant(),
    deleted: false,
  }
  return ecrire('categories', ligne)
}

/**
 * Suppression LOGIQUE. Une suppression faite hors-ligne doit pouvoir se
 * propager au serveur : effacer la ligne la rendrait invisible a la synchro,
 * et le serveur la reinjecterait au prochain pull.
 */
export async function supprimer(table, id) {
  const db = await base()
  const ligne = await db.get(table, id)
  if (!ligne) return null
  return ecrire(table, { ...ligne, deleted: true, updated_at: maintenant() })
}

/* ==========================================================================
   Recus
   ========================================================================== */

/**
 * Attache une photo de recu a une depense.
 *
 * Les metadonnees passent par `ecrire()` — donc par l'outbox, donc vers
 * Supabase. Les images, elles, sont ecrites directement : elles relevent du
 * stockage de fichiers et suivent leur propre chemin de synchronisation.
 */
export async function enregistrerRecu({ id, depense_id, prepare, nom = '' }) {
  const db = await base()
  const cle = id ?? crypto.randomUUID()

  await db.put('recus_images', {
    id: cle,
    image: prepare.blob,
    vignette: prepare.vignette,
  })

  return ecrire('recus', {
    id: cle,
    depense_id,
    nom,
    mime: prepare.mime,
    taille: prepare.taille,
    largeur: prepare.largeur,
    hauteur: prepare.hauteur,
    // Chemin distant, renseigne par la synchro une fois l'image televersee.
    chemin_distant: null,
    updated_at: maintenant(),
    deleted: false,
  })
}

/** Charge une image de recu. `variante` : 'image' (pleine) ou 'vignette'. */
export async function lireImageRecu(id, variante = 'image') {
  const db = await base()
  const ligne = await db.get('recus_images', id)
  return ligne?.[variante] ?? null
}

export async function supprimerRecu(id) {
  const db = await base()
  // L'image part tout de suite — c'est elle qui occupe la place. La
  // metadonnee, elle, reste en suppression logique pour que l'effacement se
  // propage au serveur.
  await db.delete('recus_images', id)
  return supprimer('recus', id)
}

/** Recus dont l'image n'a pas encore ete televersee. */
export async function recusATeleverser(limite = 5) {
  const db = await base()
  const metas = await db.getAll('recus')
  return metas.filter((r) => !r.deleted && !r.chemin_distant).slice(0, limite)
}

/** Note qu'une image est arrivee sur le serveur. Repasse par l'outbox pour
 *  que le chemin distant soit connu des autres appareils. */
export async function marquerRecuTeleverse(id, chemin) {
  const db = await base()
  const ligne = await db.get('recus', id)
  if (!ligne) return null
  return ecrire('recus', { ...ligne, chemin_distant: chemin, updated_at: maintenant() })
}

/** Poids total des images stockees, pour l'indicateur des Reglages. */
export async function poidsRecus() {
  const db = await base()
  const metas = await db.getAll('recus')
  return metas.filter((r) => !r.deleted).reduce((t, r) => t + (r.taille || 0), 0)
}

/* ==========================================================================
   Outbox — consommee par lib/sync.js
   ========================================================================== */

export async function lireOutbox(limite = 100) {
  const db = await base()
  const toutes = await db.getAll('outbox')
  return toutes.slice(0, limite)
}

export async function compterOutbox() {
  const db = await base()
  return db.count('outbox')
}

export async function retirerOutbox(seqs) {
  const db = await base()
  const tx = db.transaction('outbox', 'readwrite')
  for (const seq of seqs) await tx.store.delete(seq)
  await tx.done
}

export async function marquerEchec(seqs) {
  const db = await base()
  const tx = db.transaction('outbox', 'readwrite')
  for (const seq of seqs) {
    const l = await tx.store.get(seq)
    if (l) await tx.store.put({ ...l, attempts: (l.attempts || 0) + 1 })
  }
  await tx.done
}

/**
 * Fusion d'une ligne venue du serveur, en last-write-wins sur `updated_at`.
 * N'ecrit PAS dans l'outbox : cette donnee vient deja du serveur, la
 * renvoyer creerait une boucle de synchronisation.
 */
export async function fusionnerDepuisServeur(table, lignes) {
  const db = await base()
  const tx = db.transaction(table, 'readwrite')
  for (const brute of lignes) {
    // `kiosque_id` est retire : il est repose par le serveur a chaque
    // ecriture (valeur par defaut). Le garder en local ferait echouer les
    // envois si le compte rejoignait un jour un autre kiosque.
    //
    // `user_id` est CONSERVE : il dit qui a saisi la ligne, et c'est ce qui
    // permet d'afficher « saisi par Marie » quand plusieurs personnes
    // utilisent le meme kiosque.
    const { kiosque_id: _ignore, ...distante } = brute

    const locale = await tx.store.get(distante.id)
    if (!locale || distante.updated_at > locale.updated_at) {
      await tx.store.put(distante)
    }
  }
  await tx.done
}

/* ==========================================================================
   Import / export / reinitialisation
   ========================================================================== */

const enBase64 = (blob) =>
  new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result).split(',')[1])
    fr.onerror = rej
    fr.readAsDataURL(blob)
  })

async function depuisBase64(b64, mime) {
  const bin = atob(b64)
  const octets = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i)
  return new Blob([octets], { type: mime })
}

/**
 * Sauvegarde complete, images comprises.
 *
 * Les recus sont encodes en base64 : sans eux, restaurer une sauvegarde
 * rendrait les chiffres mais perdrait les preuves d'achat — ce qui viderait
 * la fonctionnalite de son sens. Le fichier grossit (~1,3x le poids des
 * images), c'est le prix a payer pour un export en un seul fichier.
 */
export async function exporterJSON({ avecRecus = true } = {}) {
  const db = await base()
  const [journees, depenses, categories, recus, reglages] = await Promise.all([
    db.getAll('journees'),
    db.getAll('depenses'),
    db.getAll('categories'),
    db.getAll('recus'),
    lireReglages(),
  ])

  let images = []
  if (avecRecus) {
    const brutes = await db.getAll('recus_images')
    images = await Promise.all(
      brutes.map(async (l) => ({
        id: l.id,
        image: await enBase64(l.image),
        vignette: l.vignette ? await enBase64(l.vignette) : null,
      })),
    )
  }

  return {
    application: NOM_APPLICATION,
    version: 2,
    exporte_le: maintenant(),
    journees,
    depenses,
    categories,
    recus,
    recus_images: images,
    reglages,
  }
}

export async function importerJSON(donnees) {
  if (!donnees || !NOMS_ACCEPTES.includes(donnees.application)) {
    throw new Error(`Ce fichier n'est pas une sauvegarde ${NOM_APPLICATION}.`)
  }
  const db = await base()
  const tx = db.transaction([...TABLES, 'outbox'], 'readwrite')
  for (const table of TABLES) {
    const store = tx.objectStore(table)
    for (const ligne of donnees[table] ?? []) {
      await store.put(ligne)
      await tx.objectStore('outbox').add({
        table,
        row_id: ligne.id,
        payload: ligne,
        attempts: 0,
        cree_le: maintenant(),
      })
    }
  }
  await tx.done

  // Les images sont restaurees hors transaction : le decodage base64 est
  // asynchrone et ferait expirer une transaction IndexedDB.
  for (const l of donnees.recus_images ?? []) {
    await db.put('recus_images', {
      id: l.id,
      image: await depuisBase64(l.image, 'image/jpeg'),
      vignette: l.vignette ? await depuisBase64(l.vignette, 'image/jpeg') : null,
    })
  }

  if (donnees.reglages) await ecrireReglages(donnees.reglages)
}

/** Vide tout, y compris l'outbox — utilise par « Reinitialiser ». */
export async function toutEffacer() {
  const db = await base()
  const stores = [...TABLES, 'recus_images', 'reglages', 'outbox']
  const tx = db.transaction(stores, 'readwrite')
  for (const s of stores) await tx.objectStore(s).clear()
  await tx.done
}

/* ==========================================================================
   Amorcage
   ========================================================================== */

export const CATEGORIES_DEFAUT = [
  {
    id: 'cat-reappro',
    // Court volontairement : sur un ecran de 390px, un libelle plus long est
    // tronque dans le journal. Renommable dans Reglages.
    nom: "Camion d'eau",
    color: '#222026',
    unit: 'gallon',
    suit_gallons: true,
    position: 0,
  },
  {
    id: 'cat-materiel',
    nom: 'Achat matériel',
    color: '#2672DD',
    unit: 'montant',
    suit_gallons: false,
    position: 1,
  },
]

/**
 * Reecrit les positions dans l'ordre fourni.
 *
 * Toutes les lignes sont reecrites, pas seulement celles qui ont bouge :
 * deplacer un element du haut vers le bas change la position de tout ce qui
 * se trouve entre les deux, et n'en sauvegarder qu'une partie laisserait des
 * positions en double apres synchronisation.
 */
export async function reordonnerCategories(ids) {
  const db = await base()
  const existantes = await db.getAll('categories')
  const parId = new Map(existantes.map((c) => [c.id, c]))

  for (const [position, id] of ids.entries()) {
    const c = parId.get(id)
    if (!c || c.position === position) continue
    await ecrire('categories', { ...c, position, updated_at: maintenant() })
  }
}

/** Cree les categories par defaut si la base est vierge. */
export async function amorcerCategories() {
  const db = await base()
  const nb = await db.count('categories')
  if (nb > 0) return
  for (const c of CATEGORIES_DEFAUT) await enregistrerCategorie(c)
}

export async function estVierge() {
  const db = await base()
  const [j, d] = await Promise.all([db.count('journees'), db.count('depenses')])
  return j === 0 && d === 0
}

export { cleJour }
