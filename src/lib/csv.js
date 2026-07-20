/**
 * Lecture et ecriture de CSV, compatibles Excel en francais.
 *
 * Quatre details font toute la difference entre un fichier qui s'ouvre
 * proprement d'un double-clic et un fichier illisible :
 *
 *   1. Le BOM UTF-8 en tete. Sans lui, Excel lit le fichier en ANSI et
 *      « Réapprovisionnement » devient « RÃ©approvisionnement ».
 *   2. Le point-virgule comme separateur. Excel en configuration francaise
 *      attend `;` ; avec une virgule il empile tout dans la colonne A.
 *   3. La virgule decimale. « 7,50 » est un nombre pour Excel francais,
 *      « 7.50 » est du texte.
 *   4. Les fins de ligne CRLF, attendues par la specification CSV.
 *
 * A la LECTURE en revanche, on est permissif : separateur devine, virgule ou
 * point decimal acceptes. Un fichier retouche sur un autre poste doit pouvoir
 * revenir sans ceremonie.
 */

const BOM = '﻿'
const SEP = ';'
const EOL = '\r\n'

/* ==========================================================================
   Ecriture
   ========================================================================== */

function echapper(valeur) {
  const s = valeur == null ? '' : String(valeur)
  // Un champ contenant le separateur, un guillemet ou un saut de ligne doit
  // etre entoure de guillemets, les guillemets internes etant doubles.
  return /[";\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** Nombre au format francais : virgule decimale, sans separateur de milliers.
 *  Les espaces de milliers casseraient la relecture par Excel. */
export function nombreCSV(n, decimales = 2) {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toFixed(decimales).replace('.', ',')
}

export function versCSV(colonnes, lignes) {
  const entete = colonnes.map((c) => echapper(c.titre)).join(SEP)
  const corps = lignes.map((l) => colonnes.map((c) => echapper(c.valeur(l))).join(SEP))
  return BOM + [entete, ...corps].join(EOL) + EOL
}

/* ==========================================================================
   Lecture
   ========================================================================== */

/** Devine le separateur en comparant les occurrences sur la ligne d'entete. */
function devinerSeparateur(entete) {
  const compte = (c) => (entete.split(c).length - 1)
  return compte(';') >= compte(',') ? ';' : ','
}

/**
 * Analyseur CSV complet : gere les champs entre guillemets, les guillemets
 * doubles et les sauts de ligne a l'interieur d'un champ. Un simple
 * `split(';')` casserait sur la premiere note contenant un point-virgule.
 */
function analyser(source, sep) {
  // Fins de ligne normalisees en amont : sans cela un CRLF a l'interieur d'un
  // champ entre guillemets laisserait un \r colle au texte, invisible a
  // l'ecran mais bien present dans la donnee enregistree.
  const texte = source.replace(/\r\n?/g, '\n')

  const lignes = []
  let champ = ''
  let ligne = []
  let dansGuillemets = false

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]

    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"'
          i++
        } else dansGuillemets = false
      } else champ += c
      continue
    }

    if (c === '"') dansGuillemets = true
    else if (c === sep) {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n') {
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else champ += c
  }

  if (champ !== '' || ligne.length) {
    ligne.push(champ)
    lignes.push(ligne)
  }
  return lignes
}

/** Transforme un CSV en tableau d'objets indexes par les titres de colonnes. */
export function depuisCSV(texte) {
  const propre = texte.replace(/^﻿/, '')
  const premiere = propre.split(/\r?\n/, 1)[0] ?? ''
  const sep = devinerSeparateur(premiere)

  const lignes = analyser(propre, sep).filter((l) => l.some((c) => c.trim() !== ''))
  if (lignes.length < 2) return { entetes: [], lignes: [] }

  const entetes = lignes[0].map((h) => h.trim())
  return {
    entetes,
    lignes: lignes.slice(1).map((l) => {
      const o = {}
      entetes.forEach((h, i) => (o[h] = (l[i] ?? '').trim()))
      return o
    }),
  }
}

/** Lit un nombre ecrit a la francaise ou a l'anglaise. */
export function lireNombreCSV(v) {
  if (v == null || v === '') return null
  const s = String(v)
    .replace(/\s/g, '')
    .replace(/ | /g, '')
    .replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/* ==========================================================================
   Schemas des deux exports
   ========================================================================== */

/**
 * L'identifiant est expose en derniere colonne. Il n'interesse personne a la
 * lecture, mais c'est lui qui permet de reimporter un fichier corrige sans
 * creer de doublons : sans lui, chaque import ajouterait une copie.
 */
export const COLONNES_RECETTES = [
  { titre: 'Date', valeur: (j) => j.date },
  { titre: 'Montant encaissé (HTG)', valeur: (j) => nombreCSV(j.montant, 0) },
  { titre: 'Dont MonCash (HTG)', valeur: (j) => nombreCSV(j.moncash, 0) },
  { titre: 'Gallons vendus', valeur: (j) => nombreCSV(j.gallons, 0) },
  { titre: 'Prix de vente (HTG/gallon)', valeur: (j) => nombreCSV(j.prix_reference) },
  {
    titre: 'Origine des gallons',
    valeur: (j) => (j.gallons_source === 'compteur' ? 'Compteur' : 'Estimé'),
  },
  { titre: 'Relevé compteur', valeur: (j) => nombreCSV(j.releve_compteur, 0) },
  { titre: 'Note', valeur: (j) => j.note },
  { titre: 'Identifiant', valeur: (j) => j.id },
]

export const COLONNES_DEPENSES = [
  { titre: 'Date', valeur: (d) => d.date },
  { titre: 'Catégorie', valeur: (d) => d.categorie },
  // Sans cette colonne, reimporter apres un effacement recreerait « Camion
  // d'eau » comme un achat ordinaire : les gallons cesseraient d'alimenter le
  // stock et la marge tomberait a zero, sans le moindre message d'erreur.
  { titre: 'Type', valeur: (d) => (d.suitGallons ? 'Approvisionnement' : 'Achat') },
  { titre: 'Article', valeur: (d) => d.designation },
  { titre: 'Quantité', valeur: (d) => nombreCSV(d.quantity, 0) },
  { titre: 'Prix unitaire (HTG)', valeur: (d) => nombreCSV(d.unit_price) },
  { titre: 'Montant (HTG)', valeur: (d) => nombreCSV(d.total, 0) },
  { titre: 'Paiement', valeur: (d) => (d.payment_method === 'moncash' ? 'MonCash' : 'Cash') },
  { titre: 'Reçus', valeur: (d) => d.nbRecus || '' },
  { titre: 'Note', valeur: (d) => d.note },
  { titre: 'Identifiant', valeur: (d) => d.id },
]

/** Reconnait le contenu d'un CSV a partir de ses en-tetes. */
export function typeDeCSV(entetes) {
  const set = new Set(entetes)
  if (set.has('Montant encaissé (HTG)') || set.has('Gallons vendus')) return 'recettes'
  if (set.has('Montant (HTG)') || set.has('Catégorie')) return 'depenses'
  return null
}
