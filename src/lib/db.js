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
  // Vide, et non « Administrateur » : un nom invente ne designe personne.
  // L'accueil affiche alors « Bonjour » seul, jusqu'a ce qu'on sache qui
  // est la — nom saisi a l'entree dans le kiosque, ou tire de l'email.
  nom_utilisateur: '',

  // Rappel de cloture. Local a l'appareil, comme le verrou : chacun choisit
  // d'etre rappele ou non, a l'heure qui l'arrange, sans l'imposer a l'autre
  // personne du kiosque. `rappel_actif` reste faux par defaut — on ne notifie
  // personne sans son accord.
  rappel_actif: false,
  rappel_heure: '20:00',

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

/**
 * La ligne pour cette date, SUPPRIMEE OU NON.
 *
 * A distinguer de `journeeDuJour`, qui ne renvoie que les journees vivantes.
 * Ici on veut la ligne brute, car l'index `date` est UNIQUE : une journee
 * supprimee occupe toujours sa date. Reclôturer cette date doit reutiliser
 * cette meme ligne — la ressusciter — et non en creer une seconde, qui
 * violerait l'unicite et ferait echouer l'enregistrement en silence.
 */
async function ligneParDate(date) {
  const db = await base()
  return (await db.getFromIndex('journees', 'date', date)) ?? null
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
  // On cherche la ligne existante SUPPRIMEE OU NON : si la date a deja ete
  // clôturee puis supprimee, on reutilise son identifiant pour la ressusciter
  // (deleted repasse a false) au lieu d'inserer une ligne concurrente qui
  // heurterait l'index unique sur la date — et ferait echouer l'enregistrement.
  const existante = await ligneParDate(date)
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

/**
 * Supprime une depense ET les recus qui la justifient.
 *
 * Les laisser derriere ne ferait pas qu'encombrer : leurs photos resteraient
 * dans le stockage Supabase indefiniment, rattachees a une depense qui n'existe
 * plus, et plus rien ne declencherait leur purge.
 */
export async function supprimerDepense(id) {
  const db = await base()
  const recus = await db.getAll('recus')
  for (const r of recus.filter((x) => x.depense_id === id && !x.deleted)) {
    await supprimerRecu(r.id)
  }
  return supprimer('depenses', id)
}

/** Recus dont l'image n'a pas encore ete televersee. */
export async function recusATeleverser(limite = 5) {
  const db = await base()
  const metas = await db.getAll('recus')
  return metas.filter((r) => !r.deleted && !r.chemin_distant).slice(0, limite)
}

/**
 * Recus dont la fiche est la, mais dont l'IMAGE manque en local.
 *
 * C'est le cas de tout appareil qui recoit un recu par synchronisation : la
 * ligne descend du serveur avec son `chemin_distant`, mais l'image, elle, vit
 * dans le stockage et n'est pas rapatriee au passage. Sans ce rattrapage,
 * l'employe verrait une vignette vide a la place du recu du proprietaire — et
 * le proprietaire lui-meme les perdrait apres un changement de compte, qui
 * vide la base locale.
 */
export async function recusATelecharger(limite = 5) {
  const db = await base()
  const metas = await db.getAll('recus')
  const out = []
  for (const r of metas) {
    if (r.deleted || !r.chemin_distant) continue
    // La presence de l'image est verifiee store par store : une fiche peut
    // exister sans son blob, c'est precisement le cas qu'on repare.
    const image = await db.get('recus_images', r.id)
    if (!image?.image) out.push(r)
    if (out.length >= limite) break
  }
  return out
}

/** Range une image rapatriee du serveur, avec sa vignette. */
export async function enregistrerImageRecu(id, image, vignette) {
  const db = await base()
  await db.put('recus_images', { id, image, vignette: vignette ?? image })
}

/** Note qu'une image est arrivee sur le serveur. Repasse par l'outbox pour
 *  que le chemin distant soit connu des autres appareils. */
export async function marquerRecuTeleverse(id, chemin) {
  const db = await base()
  const ligne = await db.get('recus', id)
  if (!ligne) return null
  return ecrire('recus', { ...ligne, chemin_distant: chemin, updated_at: maintenant() })
}

/**
 * Recus supprimes dont la photo occupe encore de la place sur le serveur.
 *
 * La suppression d'un recu est LOGIQUE — la ligne reste, marquee `deleted`,
 * pour que l'effacement se propage aux autres appareils. Mais l'image, elle,
 * vit dans le stockage et rien ne l'y efface : sans cette purge, chaque recu
 * supprime continuerait de consommer le quota, pour toujours.
 */
export async function recusAPurger(limite = 5) {
  const db = await base()
  const metas = await db.getAll('recus')
  return metas.filter((r) => r.deleted && r.chemin_distant).slice(0, limite)
}

/** L'image n'est plus sur le serveur : on oublie son chemin. */
export async function marquerRecuPurge(id) {
  const db = await base()
  const ligne = await db.get('recus', id)
  if (!ligne) return null
  // Ecriture DIRECTE, sans passer par l'outbox : le chemin distant n'interesse
  // que cet appareil une fois l'image effacee, et le renvoyer ferait remonter
  // une ligne supprimee.
  return db.put('recus', { ...ligne, chemin_distant: null })
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
  // Les lignes mises en quarantaine sont ecartees : elles sont refusees par le
  // serveur de facon definitive, et les relire indefiniment empecherait tout
  // ce qui les suit de partir.
  return toutes.filter((e) => !e.bloque).slice(0, limite)
}

export async function compterOutbox() {
  const db = await base()
  const toutes = await db.getAll('outbox')
  return toutes.filter((e) => !e.bloque).length
}

/**
 * Lignes que le serveur refuse obstinement.
 *
 * Elles restent en base — rien n'est perdu, et elles reapparaitront dans un
 * export — mais elles ne sont plus rejouees.
 */
export async function compterBloques() {
  const db = await base()
  const toutes = await db.getAll('outbox')
  return toutes.filter((e) => e.bloque).length
}

/**
 * Met une ligne en quarantaine apres plusieurs refus definitifs.
 *
 * C'est le garde-fou qui manquait : `pousser()` envoie par lots et s'arretait
 * au premier refus, si bien qu'UNE ligne malformee suffisait a empecher pour
 * toujours l'envoi des recettes et des depenses. Le cas s'est produit trois
 * fois — identifiants non-uuid, puis identifiants de categorie en collision
 * entre deux kiosques. Isoler le fautif laisse passer le reste.
 */
/**
 * Renumerote une categorie que le serveur refuse definitivement.
 *
 * Le cas se produit quand son identifiant est deja pris par un AUTRE kiosque :
 * `categories.id` est une cle primaire globale, si bien que l'upsert bascule
 * vers une ligne invisible et la policy le refuse. Aucune insistance ne peut
 * en venir a bout — il faut changer d'identifiant.
 *
 * Sans cela le degat depasse la categorie : `depenses.category_id` la
 * reference, donc chaque depense rattachee serait refusee a son tour pour
 * violation de cle etrangere.
 *
 * On ne renumerote qu'apres un refus AVERE : si la ligne appartenait vraiment
 * a ce kiosque, le serveur l'aurait acceptee. Le risque d'orpheline est nul.
 */
/**
 * Adopte une categorie deja presente sur le serveur, a la place d'un doublon
 * local refuse.
 *
 * Depuis l'index unique `(kiosque_id, nom)`, le serveur refuse une seconde
 * categorie vivante de meme nom. Quand cela arrive, inutile d'insister : il en
 * existe deja une bonne cote serveur. On y rattache les depenses du doublon,
 * puis on efface le doublon local — il n'a jamais atteint le serveur, une
 * suppression physique suffit.
 */
export async function adopterCategorie(ancienId, nouvelId) {
  const db = await base()
  if (ancienId === nouvelId) return

  const depenses = await db.getAll('depenses')
  for (const d of depenses.filter((x) => x.category_id === ancienId)) {
    await ecrire('depenses', { ...d, category_id: nouvelId, updated_at: maintenant() })
  }

  const enAttente = await db.getAll('outbox')
  const seqs = enAttente
    .filter((e) => e.row_id === ancienId || e.payload?.category_id === ancienId)
    .map((e) => e.seq)
  if (seqs.length) await retirerOutbox(seqs)
  await db.delete('categories', ancienId)
}

export async function renumeroterCategorie(ancienId) {
  const db = await base()
  const categorie = await db.get('categories', ancienId)
  if (!categorie) return null

  const nouvelId = crypto.randomUUID()
  await ecrire('categories', { ...categorie, id: nouvelId, updated_at: maintenant() })

  const depenses = await db.getAll('depenses')
  for (const d of depenses.filter((x) => x.category_id === ancienId)) {
    await ecrire('depenses', { ...d, category_id: nouvelId, updated_at: maintenant() })
  }

  // L'ancienne ligne n'a jamais atteint le serveur : suppression physique, et
  // purge de ce qui la concernait encore dans la file.
  const enAttente = await db.getAll('outbox')
  const seqs = enAttente
    .filter((e) => e.row_id === ancienId || e.payload?.category_id === ancienId)
    .map((e) => e.seq)
  if (seqs.length) await retirerOutbox(seqs)
  await db.delete('categories', ancienId)

  return nouvelId
}

/**
 * Fusionne les categories par defaut apparaissant en double.
 *
 * Chaque appareil amorce ses propres categories, avec des identifiants tires
 * au hasard. Si le meme kiosque est ouvert depuis un second appareil — ou
 * apres une reinstallation, ou un « Repartir de zero » — les siennes partent
 * sur le serveur et s'ajoutent a celles qui s'y trouvent deja : « Camion
 * d'eau » apparait alors deux fois dans la liste des depenses.
 *
 * Seuls les LIBELLES PAR DEFAUT sont concernes. Une categorie creee ou
 * renommee par l'utilisateur n'est jamais touchee, meme si son nom se repete :
 * c'est un choix qui lui appartient.
 *
 * Le survivant est le plus petit identifiant. Ce critere n'a rien d'esthetique
 * — il doit etre DETERMINISTE : deux appareils qui fusionnent chacun de leur
 * cote doivent designer le meme, sans quoi ils s'effaceraient mutuellement.
 */
export async function fusionnerCategoriesHomonymes() {
  const db = await base()
  const categories = (await db.getAll('categories')).filter((c) => !c.deleted)
  const nomsDefaut = new Set(CATEGORIES_DEFAUT.map((c) => c.nom))

  const groupes = new Map()
  for (const c of categories.filter((x) => nomsDefaut.has(x.nom))) {
    if (!groupes.has(c.nom)) groupes.set(c.nom, [])
    groupes.get(c.nom).push(c)
  }

  let fusionnees = 0
  for (const [, groupe] of groupes) {
    if (groupe.length < 2) continue
    const [survivant, ...doublons] = [...groupe].sort((a, b) => (a.id < b.id ? -1 : 1))

    // Les depenses sont repointees AVANT la suppression : sans cela elles
    // perdraient leur libelle et leur nature (« suit les gallons »), ce qui
    // fausserait le stock et la marge.
    const depenses = await db.getAll('depenses')
    for (const d of depenses.filter((x) => doublons.some((c) => c.id === x.category_id))) {
      await ecrire('depenses', { ...d, category_id: survivant.id, updated_at: maintenant() })
    }

    // Suppression LOGIQUE : ces lignes existent probablement deja sur le
    // serveur, et il faut que leur disparition s'y propage.
    for (const c of doublons) {
      await ecrire('categories', { ...c, deleted: true, updated_at: maintenant() })
      fusionnees++
    }
  }

  return fusionnees
}

export async function bloquerOutbox(seqs, raison = '') {
  const db = await base()
  const tx = db.transaction('outbox', 'readwrite')
  for (const seq of seqs) {
    const l = await tx.store.get(seq)
    if (l) await tx.store.put({ ...l, bloque: true, raison })
  }
  await tx.done
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

/** Identifiants des lignes en attente d'envoi — protegees a la fusion. */
export async function idsOutboxEnAttente() {
  const db = await base()
  const toutes = await db.getAll('outbox')
  return new Set(toutes.map((e) => e.row_id))
}

/**
 * Fusion d'une ligne venue du serveur.
 *
 * Le serveur fait FOI : sa version est adoptee telle quelle. On ne compare
 * plus les `updated_at` — ce serait comparer deux horloges d'appareils, la
 * source meme du probleme. Depuis que Postgres horodate lui-meme (voir
 * migration-horodatage.sql), il n'y a qu'une horloge, et le curseur de
 * synchronisation suffit a dire ce qui a change.
 *
 * L'UNIQUE exception : une ligne modifiee localement et pas encore envoyee
 * (`idsEnAttente`). On la protege, sinon un pull ecraserait une saisie que le
 * serveur n'a pas encore recue. Elle partira au prochain push, et le serveur
 * l'horodatera alors la plus recente.
 *
 * N'ecrit PAS dans l'outbox : cette donnee vient deja du serveur, la renvoyer
 * creerait une boucle de synchronisation.
 */
export async function fusionnerDepuisServeur(table, lignes, idsEnAttente = new Set()) {
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

    // Une saisie locale non encore envoyee prime : on ne l'ecrase pas.
    if (idsEnAttente.has(distante.id)) continue
    await tx.store.put(distante)
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
export const CLE_KIOSQUE_LOCAL = 'kiosque_local'

/**
 * La base contient-elle des donnees de DEMONSTRATION ?
 *
 * Tant que ce drapeau est leve, la synchronisation ne pousse rien. Soixante
 * jours de chiffres inventes qui arriveraient dans un vrai kiosque seraient
 * indiscernables des vrais a l'oeil nu — et devraient etre demeles ligne a
 * ligne. « Repartir de zero » abaisse le drapeau.
 */
export const CLE_DONNEES_DEMO = 'donnees_demo'

/**
 * Rattache la base locale a un kiosque, et la VIDE si l'appareil en change.
 *
 * Sans ce garde-fou, l'application se comportait de facon trompeuse : la base
 * locale appartient a l'APPAREIL, pas au compte. Quelqu'un qui se connectait
 * avec un compte neuf sur un telephone deja utilise retrouvait donc a l'ecran
 * les chiffres de l'occupant precedent — des chiffres qu'il n'avait aucun
 * droit de voir, et dont il ne pouvait pas deviner l'origine.
 *
 * Pire : la moindre modification de sa part remettait ces lignes dans la file
 * d'envoi, et les recopiait dans SON kiosque. La comptabilite de l'un se
 * serait deversee dans celle de l'autre.
 *
 * Vider est sans risque des lors que tout est deja parti sur le serveur —
 * c'est pourquoi la deconnexion refuse de laisser des saisies en attente.
 */
export async function rattacherAuKiosque(idKiosque) {
  const precedent = await lireMeta(CLE_KIOSQUE_LOCAL, null)
  const change = Boolean(precedent) && precedent !== idKiosque

  if (change) {
    await toutEffacer()
    // Le curseur doit repartir de zero, sinon le nouveau kiosque ne
    // redescendrait que ses lignes modifiees depuis le dernier passage — et
    // l'appareil resterait a moitie vide.
    await ecrireMeta('dernier_pull', null)
  }

  await ecrireMeta(CLE_KIOSQUE_LOCAL, idKiosque)
  return change
}

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

/**
 * Categories par defaut — SANS identifiant fige.
 *
 * L'identifiant est tire au hasard a l'amorcage, sur chaque appareil. Il l'a
 * deja ete en chaine lisible (« cat-reappro »), puis en uuid FIXE ; les deux
 * ont bloque la synchronisation, pour deux raisons differentes :
 *
 *  - chaine lisible : Postgres attend un uuid et rejetait le lot entier ;
 *  - uuid fixe : `categories.id` est une cle primaire GLOBALE cote serveur.
 *    Deux kiosques amorcaient donc les deux MEMES identifiants. Le second
 *    voyait son `on conflict (id)` bascule vers une ligne appartenant a un
 *    autre kiosque — donc invisible pour lui — et la policy la refusait
 *    (« violates row-level security policy (USING expression) »).
 *
 * Dans les deux cas la consequence etait la meme, et grave : `pousser()`
 * s'arrete au premier refus, si bien que les recettes et les depenses ne
 * partaient plus jamais non plus.
 *
 * Au hasard, une collision entre deux kiosques est impossible. Le prix a payer
 * est que l'appareil qui REJOINT un kiosque existant amorce ses propres
 * categories avant de connaitre celles du patron : c'est
 * `abandonnerCategoriesParDefaut()` qui s'en charge, juste avant la premiere
 * synchronisation.
 */
export const CATEGORIES_DEFAUT = [
  {
    cle: 'reappro',
    // Court volontairement : sur un ecran de 390px, un libelle plus long est
    // tronque dans le journal. Renommable dans Reglages.
    nom: "Camion d'eau",
    color: '#222026',
    unit: 'gallon',
    suit_gallons: true,
    position: 0,
  },
  {
    cle: 'materiel',
    nom: 'Achat matériel',
    color: '#2672DD',
    unit: 'montant',
    suit_gallons: false,
    position: 1,
  },
  {
    cle: 'bouchon',
    nom: 'Bouchon',
    color: '#22D3F5',
    // Un achat de bouchons se saisit en article × quantite × prix unitaire,
    // comme le materiel. `suit_gallons` reste faux : ces achats sont un cout,
    // ils n'alimentent pas le stock d'eau et ne doivent pas entrer dans le
    // calcul du cout au gallon.
    unit: 'montant',
    suit_gallons: false,
    position: 2,
  },
]

/**
 * Marques locales, dans `meta` — jamais synchronisees.
 *
 * Les appareils qui portent deja les anciens identifiants FIXES les gardent :
 * ce sont eux qui possedent les lignes correspondantes sur le serveur, et les
 * renumeroter y laisserait des orphelines qui redescendraient en double au
 * prochain pull.
 */
const CLE_CATEGORIES_AMORCEES = 'categories_amorcees'
const CLE_MIGRATION_CATEGORIES = 'migration_categories'

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

/**
 * Cree les categories par defaut si la base est vierge, et renvoie celles qui
 * sont en place — appelees ou non par cet appel.
 *
 * Le retour porte les identifiants REELS : ils sont tires au hasard a
 * l'amorcage, donc personne ne peut plus les deviner depuis le module.
 */
export async function amorcerCategories() {
  const db = await base()
  const existantes = await db.getAll('categories')
  if (existantes.length > 0) return existantes

  const creees = CATEGORIES_DEFAUT.map(({ cle, ...c }) => ({ ...c, id: crypto.randomUUID() }))
  for (const c of creees) await enregistrerCategorie(c)

  // La trace de l'amorcage vit dans `meta`, et non sur la categorie elle-meme :
  // `enregistrerCategorie` ne retient que les colonnes connues du serveur, et
  // un champ en plus serait de toute facon refuse par Postgres a l'envoi.
  await ecrireMeta(CLE_CATEGORIES_AMORCEES, creees.map((c) => c.id))
  return creees
}

/**
 * Efface les categories amorcees d'office, avant de rejoindre un kiosque.
 *
 * Sans cela, l'employe arriverait avec ses deux categories a lui, puis
 * recevrait par synchronisation les deux du patron : quatre lignes, deux
 * libelles en double, et des depenses reparties entre les unes et les autres.
 *
 * Ne touche QUE des categories par defaut jamais modifiees ni utilisees : des
 * qu'une depense s'y rattache ou que le nom a change, l'appareil a une
 * histoire propre et rien n'est supprime.
 */
export async function abandonnerCategoriesParDefaut() {
  const db = await base()
  const amorcees = new Set((await lireMeta(CLE_CATEGORIES_AMORCEES, [])) ?? [])
  if (amorcees.size === 0) return 0

  const categories = await db.getAll('categories')
  const depenses = await db.getAll('depenses')
  const utilisees = new Set(depenses.map((d) => d.category_id))
  const nomsDefaut = new Set(CATEGORIES_DEFAUT.map((c) => c.nom))

  const jetables = categories.filter(
    (c) => amorcees.has(c.id) && nomsDefaut.has(c.nom) && !utilisees.has(c.id),
  )
  // Une seule categorie renommee, utilisee, ou ajoutee a la main suffit a tout
  // annuler : l'appareil a alors une histoire propre, qu'on n'efface pas.
  if (jetables.length !== categories.length) return 0

  // Suppression PHYSIQUE, et purge de l'outbox : ces lignes n'ont jamais
  // atteint le serveur — une suppression logique n'aurait rien a y propager,
  // et laisserait au contraire deux tombes a pousser.
  const enAttente = await db.getAll('outbox')
  const seqs = enAttente.filter((e) => jetables.some((c) => c.id === e.row_id)).map((e) => e.seq)
  if (seqs.length) await retirerOutbox(seqs)
  for (const c of jetables) await db.delete('categories', c.id)
  await ecrireMeta(CLE_CATEGORIES_AMORCEES, [])

  return jetables.length
}

const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Convertit les identifiants de categorie hérités (« cat-reappro ») vers le
 * format uuid.
 *
 * Sans cette reprise, une base creee avant la correction resterait bloquee :
 * Postgres refuse ces identifiants, et l'outbox rejouerait indefiniment un lot
 * voue a l'echec — emportant avec lui les recettes et les depenses, puisque
 * `pousser()` s'arrete au premier refus.
 *
 * Les depenses qui pointaient vers l'ancienne categorie sont repointees dans
 * la foulee, sinon elles perdraient leur libelle et leur nature (« suit les
 * gallons »), ce qui fausserait le stock et la marge.
 */
export async function migrerIdentifiants() {
  const db = await base()
  let corrigees = 0

  // La correspondance ancien → nouveau est PERSISTEE : les depenses peuvent
  // encore pointer vers l'ancien identifiant au lancement suivant, alors que
  // les categories, elles, sont deja converties.
  const correspondance = { ...((await lireMeta(CLE_MIGRATION_CATEGORIES, {})) ?? {}) }

  /* --- 1. Les categories elles-memes ------------------------------------ */
  const categories = await db.getAll('categories')
  for (const ancienne of categories.filter((c) => !EST_UUID.test(c.id))) {
    // Au hasard, et non vers un uuid fige : deux appareils qui migrent le
    // meme jour se retrouveraient sinon avec le meme identifiant, et le
    // second serait refuse par le serveur pour toujours.
    const nouvelId = crypto.randomUUID()
    correspondance[ancienne.id] = nouvelId
    await ecrire('categories', { ...ancienne, id: nouvelId, updated_at: maintenant() })
    // Suppression physique : cette ligne n'a jamais pu atteindre le serveur,
    // une suppression logique n'aurait rien a y propager.
    await db.delete('categories', ancienne.id)
    corrigees++
  }

  /* --- 2. Les depenses qui les referencent -------------------------------
     Traitees separement, et NON dans la boucle ci-dessus : au deuxieme
     lancement les categories sont deja converties, mais des depenses peuvent
     encore pointer vers l'ancien identifiant. Les lier ferait sauter cette
     reprise et bloquerait la synchronisation pour toujours. */
  if (corrigees > 0) await ecrireMeta(CLE_MIGRATION_CATEGORIES, correspondance)

  const depenses = await db.getAll('depenses')
  for (const d of depenses.filter((x) => x.category_id && !EST_UUID.test(x.category_id))) {
    const nouvelId = correspondance[d.category_id]
    if (!nouvelId) continue
    await ecrire('depenses', { ...d, category_id: nouvelId, updated_at: maintenant() })
    corrigees++
  }

  // Purge des entrees d'outbox vouees a l'echec.
  //
  // Il ne suffit pas de regarder l'identifiant de la ligne : une depense a bien
  // un uuid valide, mais sa charge utile peut encore pointer vers l'ancienne
  // categorie. C'est le CONTENU qu'il faut inspecter.
  //
  // On ne perd rien : les versions corrigees viennent d'etre remises en file
  // juste au-dessus. Sans cette purge, `pousser()` ne lit que les 50 premieres
  // entrees et rejouerait indefiniment les anciennes, sans jamais atteindre
  // les nouvelles.
  const invalide = (v) => typeof v === 'string' && v !== '' && !EST_UUID.test(v)
  const enAttente = await db.getAll('outbox')
  const aPurger = enAttente
    .filter((e) => invalide(e.row_id) || invalide(e.payload?.category_id))
    .map((e) => e.seq)
  if (aPurger.length) await retirerOutbox(aPurger)

  return corrigees
}

export async function estVierge() {
  const db = await base()
  const [j, d] = await Promise.all([db.count('journees'), db.count('depenses')])
  return j === 0 && d === 0
}

export { cleJour }
