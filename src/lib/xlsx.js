/**
 * Ecriture de vrais fichiers .xlsx — sans aucune dependance.
 *
 * Un .xlsx est une archive ZIP contenant quelques fichiers XML. On les
 * fabrique a la main : c'est plus de code qu'un CSV, mais ca evite d'embarquer
 * une bibliotheque de plusieurs centaines de kilo-octets dans une application
 * qui doit rester legere sur un reseau haitien.
 *
 * Pourquoi pas un CSV ? Parce qu'un CSV est un simple texte : son rendu depend
 * de la langue du tableur (separateur, virgule ou point decimal), et c'est
 * exactement ce qui cassait l'affichage. Un .xlsx porte ses propres TYPES —
 * une date est une date, un montant est un nombre — quel que soit l'Excel qui
 * l'ouvre, en francais comme en anglais.
 *
 * Ce module ne connait rien au metier : on lui donne des feuilles (nom,
 * colonnes, lignes), il rend un Blob pret a telecharger.
 */

/* --------------------------------------------------------------------------
   ZIP — methode « stockage » (sans compression), la plus simple et valide.
   -------------------------------------------------------------------------- */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(octets) {
  let c = 0xffffffff
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const encodeur = new TextEncoder()

/**
 * Assemble une archive ZIP a partir d'entrees { nom, donnees:Uint8Array }.
 * Structure : en-tetes locaux, puis annuaire central, puis fin d'annuaire.
 */
function zip(entrees) {
  const morceaux = []
  const central = []
  let decalage = 0

  const u16 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff])
  const u32 = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff])
  const pousser = (arr) => {
    morceaux.push(arr)
    decalage += arr.length
  }

  for (const e of entrees) {
    const nom = encodeur.encode(e.nom)
    const crc = crc32(e.donnees)
    const taille = e.donnees.length
    const debut = decalage

    // En-tete local.
    pousser(u32(0x04034b50))
    pousser(u16(20)) // version minimale
    pousser(u16(0)) // pas de drapeau
    pousser(u16(0)) // methode 0 = stockage
    pousser(u16(0)) // heure
    pousser(u16(0)) // date
    pousser(u32(crc))
    pousser(u32(taille)) // taille compressee = taille reelle (stockage)
    pousser(u32(taille))
    pousser(u16(nom.length))
    pousser(u16(0)) // pas d'extra
    pousser(nom)
    pousser(e.donnees)

    // Entree correspondante dans l'annuaire central.
    const c = []
    const cp = (a) => c.push(a)
    cp(u32(0x02014b50))
    cp(u16(20)) // version d'origine
    cp(u16(20)) // version minimale
    cp(u16(0))
    cp(u16(0))
    cp(u16(0))
    cp(u16(0))
    cp(u32(crc))
    cp(u32(taille))
    cp(u32(taille))
    cp(u16(nom.length))
    cp(u16(0)) // extra
    cp(u16(0)) // commentaire
    cp(u16(0)) // disque
    cp(u16(0)) // attributs internes
    cp(u32(0)) // attributs externes
    cp(u32(debut)) // decalage de l'en-tete local
    cp(nom)
    central.push(...c)
  }

  const debutCentral = decalage
  let tailleCentral = 0
  for (const arr of central) {
    morceaux.push(arr)
    tailleCentral += arr.length
  }
  decalage += tailleCentral

  // Fin d'annuaire central.
  pousser(u32(0x06054b50))
  pousser(u16(0)) // disque
  pousser(u16(0)) // disque de debut
  pousser(u16(entrees.length))
  pousser(u16(entrees.length))
  pousser(u32(tailleCentral))
  pousser(u32(debutCentral))
  pousser(u16(0)) // commentaire

  const total = morceaux.reduce((n, a) => n + a.length, 0)
  const sortie = new Uint8Array(total)
  let p = 0
  for (const a of morceaux) {
    sortie.set(a, p)
    p += a.length
  }
  return sortie
}

/* --------------------------------------------------------------------------
   XML — parties minimales d'un classeur.
   -------------------------------------------------------------------------- */

function echapper(v) {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Colonne 1 → « A », 27 → « AA ». */
function lettreColonne(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Serie Excel d'une date « AAAA-MM-JJ » : nombre de jours depuis 1899-12-30.
 *  Calcul en UTC des deux cotes pour ne subir aucun decalage de fuseau. */
function serieDate(iso) {
  const [a, m, j] = iso.split('-').map(Number)
  if (!a || !m || !j) return null
  const base = Date.UTC(1899, 11, 30)
  return Math.round((Date.UTC(a, m - 1, j) - base) / 86_400_000)
}

// Styles : 0 defaut, 1 en-tete gras, 2 date, 3 entier, 4 decimal.
const STYLE = { defaut: 0, entete: 1, date: 2, entier: 3, decimal: 4 }

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="2">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `</fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="5">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

/** Une cellule, selon le type declare par la colonne. */
function cellule(ref, valeur, type) {
  if (valeur == null || valeur === '') return `<c r="${ref}"/>`

  if (type === 'date') {
    const serie = serieDate(valeur)
    return serie == null
      ? `<c r="${ref}" t="inlineStr"><is><t>${echapper(valeur)}</t></is></c>`
      : `<c r="${ref}" s="${STYLE.date}"><v>${serie}</v></c>`
  }

  if (type === 'entier' || type === 'decimal') {
    if (!Number.isFinite(valeur)) return `<c r="${ref}"/>`
    const s = type === 'entier' ? STYLE.entier : STYLE.decimal
    return `<c r="${ref}" s="${s}"><v>${valeur}</v></c>`
  }

  // Texte : chaine en ligne, sans table partagee — plus simple, et le volume
  // reste modeste (une ligne par jour).
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${echapper(valeur)}</t></is></c>`
}

function feuilleXML(colonnes, lignes) {
  const cols = colonnes
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur ?? 16}" customWidth="1"/>`)
    .join('')

  const entete =
    `<row r="1">` +
    colonnes
      .map((c, i) => cellule(`${lettreColonne(i + 1)}1`, c.titre, 'texte').replace(
        `t="inlineStr"`,
        `s="${STYLE.entete}" t="inlineStr"`,
      ))
      .join('') +
    `</row>`

  const corps = lignes
    .map((l, r) => {
      const numLigne = r + 2
      const cellules = colonnes
        .map((c, i) => cellule(`${lettreColonne(i + 1)}${numLigne}`, c.valeur(l), c.type ?? 'texte'))
        .join('')
      return `<row r="${numLigne}">${cellules}</row>`
    })
    .join('')

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${cols}</cols>` +
    `<sheetData>${entete}${corps}</sheetData>` +
    `</worksheet>`
  )
}

/* --------------------------------------------------------------------------
   Assemblage du classeur.
   -------------------------------------------------------------------------- */

/**
 * Construit un Blob .xlsx a partir de feuilles :
 *   [{ nom, colonnes:[{ titre, valeur:(ligne)=>…, type?, largeur? }], lignes }]
 *
 * `type` vaut 'texte' (defaut), 'entier', 'decimal' ou 'date'.
 */
export function construireXLSX(feuilles) {
  const refsFeuilles = feuilles
    .map((_, i) => `<sheet name="__NOM${i}__" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')

  // Le nom de feuille est injecte apres coup pour l'echapper sans casser le
  // gabarit ; Excel limite a 31 caracteres et interdit []:*?/\.
  const nomFeuille = (n) => echapper(n.slice(0, 31).replace(/[[\]:*?/\\]/g, ' '))
  let workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${refsFeuilles}</sheets></workbook>`
  feuilles.forEach((f, i) => {
    workbook = workbook.replace(`__NOM${i}__`, nomFeuille(f.nom))
  })

  const relsFeuilles = feuilles
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
        `Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')
  const idStyles = feuilles.length + 1
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    relsFeuilles +
    `<Relationship Id="rId${idStyles}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ` +
    `Target="styles.xml"/>` +
    `</Relationships>`

  const overridesFeuilles = feuilles
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
        `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    overridesFeuilles +
    `<Override PartName="/xl/styles.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
    `Target="xl/workbook.xml"/></Relationships>`

  const entrees = [
    { nom: '[Content_Types].xml', donnees: encodeur.encode(contentTypes) },
    { nom: '_rels/.rels', donnees: encodeur.encode(rootRels) },
    { nom: 'xl/workbook.xml', donnees: encodeur.encode(workbook) },
    { nom: 'xl/_rels/workbook.xml.rels', donnees: encodeur.encode(workbookRels) },
    { nom: 'xl/styles.xml', donnees: encodeur.encode(STYLES_XML) },
    ...feuilles.map((f, i) => ({
      nom: `xl/worksheets/sheet${i + 1}.xml`,
      donnees: encodeur.encode(feuilleXML(f.colonnes, f.lignes)),
    })),
  ]

  return new Blob([zip(entrees)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
