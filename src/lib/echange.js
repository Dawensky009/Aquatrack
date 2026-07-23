/**
 * Export et import de fichiers.
 *
 * Deux formats, deux usages qu'il ne faut pas confondre :
 *
 *   - JSON : une SAUVEGARDE. Restaure tout a l'identique, photos de recus
 *     comprises. C'est le seul format qui protege reellement vos donnees.
 *
 *   - CSV : un ECHANGE. S'ouvre dans Excel, se donne a un comptable,
 *     se corrige a la main. Mais un tableur ne sait pas transporter d'images :
 *     un aller-retour par CSV perd les recus. L'interface le dit clairement
 *     plutot que de laisser la surprise pour le jour de la restauration.
 */

import * as db from './db.js'
import {
  versCSV,
  depuisCSV,
  lireNombreCSV,
  typeDeCSV,
  COLONNES_RECETTES,
  COLONNES_DEPENSES,
} from './csv.js'
import { construireXLSX } from './xlsx.js'
import { cleJour } from './format.js'

export class ErreurImport extends Error {}

/* ==========================================================================
   Telechargement
   ========================================================================== */

function telecharger(contenu, nom, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  // Revoquer immediatement couperait le telechargement sur certains
  // navigateurs : on laisse un instant a la requete pour partir.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const horodatage = () => cleJour()

/* ==========================================================================
   Export
   ========================================================================== */

export async function exporterSauvegarde() {
  const donnees = await db.exporterJSON()
  telecharger(
    JSON.stringify(donnees, null, 2),
    `aqua-track-sauvegarde-${horodatage()}.json`,
    'application/json',
  )
  return { recus: donnees.recus?.length ?? 0 }
}

export async function exporterRecettesCSV() {
  const { journees } = await db.chargerTout()
  const triees = [...journees].sort((a, b) => a.date.localeCompare(b.date))
  telecharger(
    versCSV(COLONNES_RECETTES, triees),
    `aqua-track-recettes-${horodatage()}.csv`,
    'text/csv;charset=utf-8',
  )
  return { lignes: triees.length }
}

export async function exporterDepensesCSV() {
  const { depenses, categories, recus } = await db.chargerTout()
  const lignes = [...depenses]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((d) => ({
      ...d,
      date: cleJour(new Date(d.occurred_at)),
      categorie: categories.find((c) => c.id === d.category_id)?.nom ?? '',
      suitGallons: !!categories.find((c) => c.id === d.category_id)?.suit_gallons,
      nbRecus: recus.filter((r) => r.depense_id === d.id).length,
    }))
  telecharger(
    versCSV(COLONNES_DEPENSES, lignes),
    `aqua-track-depenses-${horodatage()}.csv`,
    'text/csv;charset=utf-8',
  )
  return { lignes: lignes.length }
}

/* --------------------------------------------------------------------------
   Export Excel (.xlsx) — un vrai classeur, deux feuilles.

   A distinguer du CSV : ici chaque colonne porte un TYPE (date, montant,
   texte), si bien qu'Excel affiche des dates comme des dates et des montants
   comme des nombres, quelle que soit sa langue. Le CSV, lui, restait un texte
   dont le rendu dependait de la configuration du tableur.
   -------------------------------------------------------------------------- */

const COLS_RECETTES_XLSX = [
  { titre: 'Date', type: 'date', largeur: 12, valeur: (j) => j.date },
  { titre: 'Montant encaissé (HTG)', type: 'entier', largeur: 20, valeur: (j) => j.montant },
  { titre: 'Dont MonCash (HTG)', type: 'entier', largeur: 18, valeur: (j) => j.moncash },
  { titre: 'Gallons vendus', type: 'decimal', largeur: 15, valeur: (j) => j.gallons },
  { titre: 'Prix de vente (HTG/gallon)', type: 'decimal', largeur: 22, valeur: (j) => j.prix_reference },
  {
    titre: 'Origine des gallons',
    largeur: 18,
    valeur: (j) => (j.gallons_source === 'compteur' ? 'Compteur' : 'Estimé'),
  },
  { titre: 'Relevé compteur', type: 'entier', largeur: 15, valeur: (j) => j.releve_compteur },
  { titre: 'Note', largeur: 30, valeur: (j) => j.note },
  { titre: 'Identifiant', largeur: 38, valeur: (j) => j.id },
]

const COLS_DEPENSES_XLSX = [
  { titre: 'Date', type: 'date', largeur: 12, valeur: (d) => d.date },
  { titre: 'Catégorie', largeur: 18, valeur: (d) => d.categorie },
  { titre: 'Type', largeur: 18, valeur: (d) => (d.suitGallons ? 'Approvisionnement' : 'Achat') },
  { titre: 'Article', largeur: 24, valeur: (d) => d.designation },
  { titre: 'Quantité', type: 'entier', largeur: 12, valeur: (d) => d.quantity },
  { titre: 'Prix unitaire (HTG)', type: 'decimal', largeur: 18, valeur: (d) => d.unit_price },
  { titre: 'Montant (HTG)', type: 'entier', largeur: 16, valeur: (d) => d.total },
  { titre: 'Paiement', largeur: 12, valeur: (d) => (d.payment_method === 'moncash' ? 'MonCash' : 'Cash') },
  { titre: 'Reçus', type: 'entier', largeur: 10, valeur: (d) => d.nbRecus || null },
  { titre: 'Note', largeur: 30, valeur: (d) => d.note },
  { titre: 'Identifiant', largeur: 38, valeur: (d) => d.id },
]

export async function exporterExcel() {
  const { journees, depenses, categories, recus } = await db.chargerTout()

  const recettes = [...journees].sort((a, b) => a.date.localeCompare(b.date))
  const lignesDepenses = [...depenses]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((d) => ({
      ...d,
      date: cleJour(new Date(d.occurred_at)),
      categorie: categories.find((c) => c.id === d.category_id)?.nom ?? '',
      suitGallons: !!categories.find((c) => c.id === d.category_id)?.suit_gallons,
      nbRecus: recus.filter((r) => r.depense_id === d.id).length,
    }))

  const blob = construireXLSX([
    { nom: 'Recettes', colonnes: COLS_RECETTES_XLSX, lignes: recettes },
    { nom: 'Dépenses', colonnes: COLS_DEPENSES_XLSX, lignes: lignesDepenses },
  ])

  telecharger(blob, `aqua-track-${horodatage()}.xlsx`, blob.type)
  return { recettes: recettes.length, depenses: lignesDepenses.length }
}

/* ==========================================================================
   Import
   ========================================================================== */

/** Aiguille selon l'extension et le contenu reel du fichier. */
export async function importerFichier(fichier) {
  const texte = await fichier.text()

  if (fichier.name.toLowerCase().endsWith('.json')) {
    let donnees
    try {
      donnees = JSON.parse(texte)
    } catch {
      throw new ErreurImport("Ce fichier JSON est illisible ou incomplet.")
    }
    await db.importerJSON(donnees)
    return {
      format: 'json',
      recettes: donnees.journees?.length ?? 0,
      depenses: donnees.depenses?.length ?? 0,
      recus: donnees.recus_images?.length ?? 0,
    }
  }

  const { entetes, lignes } = depuisCSV(texte)
  if (!lignes.length) throw new ErreurImport('Ce fichier ne contient aucune ligne de données.')

  const type = typeDeCSV(entetes)
  if (type === 'recettes') return importerRecettes(lignes)
  if (type === 'depenses') return importerDepenses(lignes)

  throw new ErreurImport(
    "Colonnes non reconnues. Utilisez un fichier exporté depuis l'application, sans renommer la ligne d'en-tête.",
  )
}

const DATE_VALIDE = /^\d{4}-\d{2}-\d{2}$/

async function importerRecettes(lignes) {
  let importees = 0
  const ignorees = []

  for (const [i, l] of lignes.entries()) {
    const date = (l['Date'] ?? '').trim()
    const montant = lireNombreCSV(l['Montant encaissé (HTG)'])

    // Une ligne douteuse est ecartee et signalee, jamais devinee : mieux vaut
    // rendre la main a l'utilisateur que d'inventer un chiffre comptable.
    if (!DATE_VALIDE.test(date)) {
      ignorees.push(`ligne ${i + 2} : date « ${date || 'vide'} » invalide`)
      continue
    }
    if (montant == null || montant < 0) {
      ignorees.push(`ligne ${i + 2} : montant manquant ou négatif`)
      continue
    }

    const prix = lireNombreCSV(l['Prix de vente (HTG/gallon)']) ?? 25
    const gallons = lireNombreCSV(l['Gallons vendus']) ?? (prix > 0 ? montant / prix : 0)
    const compteur = (l['Origine des gallons'] ?? '').toLowerCase().startsWith('comp')

    await db.enregistrerJournee({
      date,
      montant,
      moncash: lireNombreCSV(l['Dont MonCash (HTG)']) ?? 0,
      gallons,
      gallons_source: compteur ? 'compteur' : 'estime',
      releve_compteur: lireNombreCSV(l['Relevé compteur']),
      prix_reference: prix,
      note: l['Note'] ?? '',
    })
    importees++
  }

  return { format: 'csv', recettes: importees, ignorees }
}

async function importerDepenses(lignes) {
  const { categories } = await db.chargerTout()
  // Copie locale : une categorie creee pendant l'import doit servir aux
  // lignes suivantes sans relire la base a chaque fois.
  const connues = new Map(categories.map((c) => [c.nom.toLowerCase(), c]))

  let importees = 0
  const ignorees = []

  for (const [i, l] of lignes.entries()) {
    const date = (l['Date'] ?? '').trim()
    const total = lireNombreCSV(l['Montant (HTG)'])

    if (!DATE_VALIDE.test(date)) {
      ignorees.push(`ligne ${i + 2} : date « ${date || 'vide'} » invalide`)
      continue
    }
    if (total == null || total === 0) {
      ignorees.push(`ligne ${i + 2} : montant manquant`)
      continue
    }

    const nomCat = (l['Catégorie'] ?? '').trim()
    if (!nomCat) {
      ignorees.push(`ligne ${i + 2} : catégorie manquante`)
      continue
    }

    // La colonne « Type » porte le marqueur d'approvisionnement. C'est lui qui
    // determine si les gallons de cette ligne alimentent le stock et la marge.
    const estAppro = (l['Type'] ?? '').toLowerCase().startsWith('appro')

    let cat = connues.get(nomCat.toLowerCase())
    if (!cat) {
      cat = await db.enregistrerCategorie({
        nom: nomCat,
        color: estAppro ? '#222026' : '#2672DD',
        unit: estAppro ? 'gallon' : 'montant',
        suit_gallons: estAppro,
        position: connues.size,
      })
      connues.set(nomCat.toLowerCase(), cat)
    } else if (estAppro && !cat.suit_gallons) {
      // La categorie existe mais a perdu son marqueur : on le retablit plutot
      // que d'importer des gallons qui ne compteraient nulle part.
      cat = await db.enregistrerCategorie({ ...cat, suit_gallons: true, unit: 'gallon' })
      connues.set(nomCat.toLowerCase(), cat)
    }

    const quantite = lireNombreCSV(l['Quantité'])

    await db.enregistrerDepense({
      id: (l['Identifiant'] ?? '').trim() || undefined,
      occurred_at: new Date(`${date}T09:00:00`).toISOString(),
      category_id: cat.id,
      designation: l['Article'] ?? '',
      quantity: quantite && quantite > 0 ? quantite : null,
      total: Math.abs(total),
      entry_mode: cat.suit_gallons ? 'forfait' : null,
      payment_method: (l['Paiement'] ?? '').toLowerCase().includes('mon') ? 'moncash' : 'cash',
      note: l['Note'] ?? '',
    })
    importees++
  }

  return { format: 'csv', depenses: importees, ignorees }
}
