/**
 * Formatage francais / haitien.
 *
 * La gourde n'a pas de symbole monetaire etabli dans Intl : on formate donc
 * le nombre en francais puis on suffixe « HTG ». Intl.NumberFormat('fr-FR')
 * produit une espace insecable etroite (U+202F) comme separateur de milliers,
 * ce qui est le comportement voulu.
 */

const nombreFr = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
})

const nombreFrDecimal = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Montant en gourdes, arrondi a l'unite. « 1 250 HTG »
 * Les montants du kiosque sont toujours des entiers en pratique.
 */
export function formatHTG(valeur, { signe = false } = {}) {
  if (valeur == null || Number.isNaN(valeur)) return '—'
  const arrondi = Math.round(valeur)
  const prefixe = signe && arrondi > 0 ? '+ ' : arrondi < 0 ? '− ' : ''
  return `${prefixe}${nombreFr.format(Math.abs(arrondi))} HTG`
}

/**
 * Prix unitaire, avec deux decimales. « 7,50 HTG »
 * Le cout par gallon tombe rarement sur un entier : 9 000 / 1 200 = 7,50.
 */
export function formatPrix(valeur) {
  if (valeur == null || Number.isNaN(valeur)) return '—'
  return `${nombreFrDecimal.format(valeur)} HTG`
}

/** Quantite de gallons. « 1 200 gallons » / « 1 gallon » */
export function formatGallons(valeur) {
  if (valeur == null || Number.isNaN(valeur)) return '—'
  const arrondi = Math.round(valeur)
  return `${nombreFr.format(arrondi)} ${arrondi === 1 ? 'gallon' : 'gallons'}`
}

/** Pourcentage signe, pour les indicateurs de variation. « +4,8 % » */
export function formatPourcent(valeur, { signe = true } = {}) {
  if (valeur == null || Number.isNaN(valeur) || !Number.isFinite(valeur)) return '—'
  const prefixe = signe && valeur > 0 ? '+' : valeur < 0 ? '−' : ''
  const abs = Math.abs(valeur)
  const decimales = abs < 10 ? 1 : 0
  return `${prefixe}${abs.toFixed(decimales).replace('.', ',')} %`
}

const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const joursCourts = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
// Accents obligatoires : ce sont des libelles montres a l'utilisateur, pas des
// identifiants internes. « fevrier » ou « aout » sautent aux yeux d'un lecteur
// francophone.
const mois = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Les cles de journee sont des chaines « AAAA-MM-JJ » en heure LOCALE.
 * Passer par toISOString() convertirait en UTC et decalerait la journee
 * pour tout fuseau a l'ouest de Greenwich — Haiti compris (UTC−5).
 * D'ou la construction manuelle.
 */
export function cleJour(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const jj = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${jj}`
}

/** Transforme « AAAA-MM-JJ » en Date locale a minuit. */
export function depuisCleJour(cle) {
  const [a, m, j] = cle.split('-').map(Number)
  return new Date(a, m - 1, j)
}

/** « lundi 20 juillet 2026 » */
export function formatDateLongue(date) {
  const d = typeof date === 'string' ? depuisCleJour(date) : date
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`
}

/** « lun. 20 juil. » */
export function formatDateCourte(date) {
  const d = typeof date === 'string' ? depuisCleJour(date) : date
  return `${joursCourts[d.getDay()]}. ${d.getDate()} ${moisCourts[d.getMonth()]}`
}

/** « 20 juil. » — pour les axes de graphique, ou la place manque */
export function formatDateAxe(date) {
  const d = typeof date === 'string' ? depuisCleJour(date) : date
  return `${d.getDate()} ${moisCourts[d.getMonth()]}`
}

/** « juillet 2026 » — en-tetes de groupe du journal */
export function formatMoisAnnee(date) {
  const d = typeof date === 'string' ? depuisCleJour(date) : date
  return `${mois[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * « Bonjour » ou « Bonsoir », selon l'heure.
 *
 * La bascule est a 18 h, l'usage francais courant. Volontairement deux
 * formules et pas trois : « Bonne nuit » se dit en partant, pas en ouvrant
 * une application — et le kiosque ouvre tot.
 */
export function salutation(date = new Date()) {
  return date.getHours() < 18 ? 'Bonjour' : 'Bonsoir'
}

/** « 14:32 » */
export function formatHeure(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Prepare un texte pour la recherche : minuscules, sans accents.
 *
 * Chercher « bouchon » doit trouver « Bouchon », et « materiel » doit trouver
 * « matériel » — sur un clavier de telephone les accents sont fastidieux, et
 * personne ne pense a les mettre pour filtrer.
 */
export function normaliser(texte) {
  return String(texte ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Lit un nombre saisi par l'utilisateur.
 * Accepte la virgule decimale francaise et les espaces de milliers.
 * Renvoie null si la saisie ne represente pas un nombre — l'appelant
 * distingue ainsi « champ vide » de « zero ».
 */
export function lireNombre(saisie) {
  if (saisie == null) return null
  const nettoye = String(saisie).replace(/\s/g, '').replace(/ /g, '').replace(',', '.')
  if (nettoye === '') return null
  const n = Number(nettoye)
  return Number.isFinite(n) ? n : null
}
