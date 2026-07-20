/**
 * Preparation des photos de recus.
 *
 * Une photo prise avec un telephone recent pese 3 a 5 Mo. Stockee telle
 * quelle, une douzaine de recus saturerait le quota du navigateur, et chaque
 * envoi vers Supabase couterait plusieurs minutes sur une connexion instable.
 *
 * On redimensionne donc a 1 600 px sur le plus grand cote et on reencode en
 * JPEG : un recu passe de ~4 Mo a ~200 Ko, et le texte reste parfaitement
 * lisible — c'est un ticket de caisse, pas une photographie d'art.
 */

const COTE_MAX = 1600
const QUALITE = 0.72
const COTE_VIGNETTE = 240

/** Taille au-dela de laquelle on refuse le fichier avant meme de le decoder. */
export const TAILLE_MAX_ENTREE = 25 * 1024 * 1024

export class ErreurImage extends Error {}

async function dessiner(bitmap, coteMax, qualite) {
  const echelle = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height))
  const largeur = Math.max(1, Math.round(bitmap.width * echelle))
  const hauteur = Math.max(1, Math.round(bitmap.height * echelle))

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur

  const ctx = canvas.getContext('2d')
  // Fond blanc : un JPEG n'a pas de transparence, et sans cela une image
  // source avec canal alpha se retrouverait sur fond noir.
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, largeur, hauteur)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur)

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', qualite))
  if (!blob) throw new ErreurImage("Impossible d'encoder l'image.")
  return { blob, largeur, hauteur }
}

/**
 * Compresse un fichier image et produit aussi une vignette.
 *
 * La vignette est stockee separement pour que la liste des recus d'une
 * depense s'affiche instantanement sans charger les images pleine taille.
 */
export async function preparerRecu(fichier) {
  if (!fichier.type.startsWith('image/')) {
    throw new ErreurImage(
      "Seules les photos sont acceptées. Prenez le reçu en photo plutôt que de joindre un PDF.",
    )
  }
  if (fichier.size > TAILLE_MAX_ENTREE) {
    throw new ErreurImage('Cette image est trop lourde (plus de 25 Mo).')
  }

  let bitmap
  try {
    // `from-image` applique l'orientation EXIF : sans cela, une photo prise en
    // tenant le telephone verticalement s'afficherait couchee.
    bitmap = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  } catch {
    throw new ErreurImage("Ce fichier n'est pas une image lisible.")
  }

  try {
    const complet = await dessiner(bitmap, COTE_MAX, QUALITE)
    const vignette = await dessiner(bitmap, COTE_VIGNETTE, 0.6)
    return {
      blob: complet.blob,
      largeur: complet.largeur,
      hauteur: complet.hauteur,
      taille: complet.blob.size,
      vignette: vignette.blob,
      mime: 'image/jpeg',
    }
  } finally {
    bitmap.close?.()
  }
}

/** « 214 Ko » / « 1,3 Mo » */
export function formatTaille(octets) {
  if (octets == null) return '—'
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}
