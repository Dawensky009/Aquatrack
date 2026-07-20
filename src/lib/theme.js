/**
 * Theme clair / sombre / systeme.
 *
 * Stocke dans localStorage et NON dans la base synchronisee : le theme est une
 * preference d'appareil. Quelqu'un qui consulte l'app sur un ordinateur en
 * plein jour et sur son telephone le soir ne veut pas le meme reglage des deux
 * cotes.
 *
 * localStorage est aussi le seul stockage lisible de maniere SYNCHRONE, ce qui
 * permet au script inline de index.html d'appliquer le theme avant le premier
 * rendu. Avec IndexedDB (asynchrone), l'utilisateur verrait un eclair blanc a
 * chaque ouverture en mode sombre.
 */

const CLE = 'kiosque-theme'
export const MODES = ['system', 'light', 'dark']

export function lireMode() {
  const m = localStorage.getItem(CLE)
  return MODES.includes(m) ? m : 'system'
}

/** Le theme reellement affiche, une fois « system » resolu. */
export function resoudre(mode = lireMode()) {
  if (mode === 'light' || mode === 'dark') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function appliquer(mode = lireMode()) {
  const theme = resoudre(mode)
  document.documentElement.dataset.theme = theme

  // La couleur de la barre systeme du navigateur doit suivre, sinon elle
  // reste blanche au-dessus d'une app sombre une fois installee.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0F0F12' : '#F3F3F3')
  return theme
}

export function ecrireMode(mode) {
  localStorage.setItem(CLE, mode)
  return appliquer(mode)
}

/**
 * Suit les changements de preference systeme.
 * Ne reagit que si l'utilisateur est en mode « system » : un choix explicite
 * ne doit jamais etre ecrase par le systeme d'exploitation.
 */
export function suivreSysteme(surChangement) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const reagir = () => {
    if (lireMode() === 'system') surChangement(appliquer('system'))
  }
  mq.addEventListener('change', reagir)
  return () => mq.removeEventListener('change', reagir)
}

/* ==========================================================================
   Couleurs de donnees
   ========================================================================== */

/**
 * Les couleurs de categorie sont stockees en dur dans la base (elles viennent
 * de la planche de marque). Le noir #222026 serait invisible sur une carte
 * sombre, et le gris clair aussi.
 *
 * On les transpose donc a l'affichage plutot que de les reecrire en base :
 * l'utilisateur qui bascule de theme ne doit pas voir ses donnees modifiees,
 * et un export reste identique quel que soit le theme actif.
 */
const TRANSPOSITION = {
  '#222026': '#E8E8EA', // le noir de marque devient l'encre claire
  '#2672DD': '#5B9BF5', // bleu eclairci, meme teinte
  '#22D3F5': '#22D3F5', // le cyan tient sur les deux fonds
  '#E4E4E6': '#4A4952', // la serie neutre s'assombrit
}

export function couleurDonnees(hex, sombre) {
  if (!sombre || !hex) return hex
  return TRANSPOSITION[hex?.toUpperCase()] ?? hex
}
