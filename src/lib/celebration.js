/**
 * Petits effets de recompense, en canvas, sans aucune dependance.
 *
 * Deux gestes n'ont pas la meme charge emotionnelle, donc pas le meme effet :
 *
 *   - Cloturer une journee, c'est encaisser : une VICTOIRE. Des confettis
 *     colores, une gerbe qui jaillit vers le haut.
 *   - Enregistrer une depense, c'est de l'argent qui SORT. Feter serait
 *     deplace. On se contente d'un accuse de reception discret : quelques
 *     gouttes fraiches qui retombent, dans les tons de l'eau.
 *
 * Le rendu est IMPERATIF et vit hors de React : l'effet doit survivre a la
 * fermeture de la feuille qui l'a declenche. On pose un canvas plein ecran,
 * on anime, puis on le retire tout seul.
 *
 * Trajectoires calculees ANALYTIQUEMENT (position = fonction du temps ecoule)
 * plutot qu'integrees image par image : le rendu est alors identique a 30 ou
 * 120 images/seconde, sans derive si une trame saute.
 */

/** Respecte le reglage systeme « animations reduites ». */
function mouvementReduit() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/**
 * Pose un canvas plein ecran au-dessus de tout, en tenant compte de la densite
 * de pixels pour rester net sur telephone. Renvoie le contexte et les
 * dimensions en pixels CSS (celles ou l'on raisonne).
 */
function poserCanvas() {
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2147483647',
  })
  canvas.setAttribute('aria-hidden', 'true')

  const L = window.innerWidth
  const H = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(L * dpr)
  canvas.height = Math.floor(H * dpr)

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  document.body.appendChild(canvas)
  return { canvas, ctx, L, H }
}

/**
 * Boucle d'animation. `dessiner(ctx, p, s)` place la particule `p` a l'instant
 * `s` (en secondes). La boucle s'arrete et nettoie le canvas d'elle-meme au
 * bout de `duree` millisecondes.
 */
function animer(canvas, ctx, particules, duree, dessiner) {
  let depart = null
  function trame(t) {
    if (depart == null) depart = t
    const ecoule = t - depart
    if (ecoule >= duree || !canvas.isConnected) {
      canvas.remove()
      return
    }
    const s = ecoule / 1000
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particules) dessiner(ctx, p, s)
    requestAnimationFrame(trame)
  }
  requestAnimationFrame(trame)
}

/** Fondu de sortie sur la derniere fraction de vie, pour ne pas couper net. */
function opacite(s, duree, fondu) {
  const finSec = duree / 1000
  return s > finSec - fondu ? Math.max(0, (finSec - s) / fondu) : 1
}

const hasard = (min, max) => min + Math.random() * (max - min)

/* ==========================================================================
   Cloture : la gerbe de confettis
   ========================================================================== */

// Bleu et cyan de la planche (l'eau), plus quelques touches vives pour la fete.
const COULEURS_FETE = ['#2672DD', '#22D3F5', '#34D399', '#FBBF24', '#F472B6']

export function celebrerCloture() {
  if (mouvementReduit()) return
  const { canvas, ctx, L, H } = poserCanvas()

  const DUREE = 1700
  const G = 1500 // gravite, px/s²
  const nb = Math.min(120, Math.round(L / 6))

  const particules = Array.from({ length: nb }, () => {
    // Cone oriente vers le haut (−90° ± ~55°), vitesse variable : la gerbe
    // s'ouvre en eventail plutot que de partir en colonne.
    const angle = -Math.PI / 2 + hasard(-0.95, 0.95)
    const vitesse = hasard(650, 1300)
    return {
      x0: L / 2 + hasard(-40, 40),
      y0: H * 0.82,
      vx: Math.cos(angle) * vitesse,
      vy: Math.sin(angle) * vitesse,
      taille: hasard(6, 12),
      couleur: COULEURS_FETE[Math.floor(hasard(0, COULEURS_FETE.length))],
      rot0: hasard(0, Math.PI * 2),
      spin: hasard(-9, 9),
      // Un rectangle qui tourne « de profil » s'amincit : c'est ce battement
      // qui donne l'illusion d'un vrai confetti qui virevolte.
      ratio: hasard(0.5, 1),
    }
  })

  animer(canvas, ctx, particules, DUREE, (c, p, s) => {
    const x = p.x0 + p.vx * s
    const y = p.y0 + p.vy * s + 0.5 * G * s * s
    if (y > H + 40) return
    c.save()
    c.globalAlpha = opacite(s, DUREE, 0.45)
    c.translate(x, y)
    c.rotate(p.rot0 + p.spin * s)
    c.fillStyle = p.couleur
    const l = p.taille
    const h = p.taille * p.ratio * (0.6 + 0.4 * Math.cos(s * 8 + p.rot0))
    c.fillRect(-l / 2, -h / 2, l, h)
    c.restore()
  })
}

/* ==========================================================================
   Depense : l'accuse de reception, quelques gouttes fraiches
   ========================================================================== */

const COULEURS_EAU = ['#2672DD', '#22D3F5', '#64748B', '#94A3B8']

export function celebrerDepense() {
  if (mouvementReduit()) return
  const { canvas, ctx, L, H } = poserCanvas()

  const DUREE = 1300
  const G = 420
  const nb = 26

  const particules = Array.from({ length: nb }, () => {
    // Depuis le centre-haut, un cone vers le BAS : l'argent qui s'en va,
    // doucement, sans eclat.
    const angle = Math.PI / 2 + hasard(-0.7, 0.7)
    const vitesse = hasard(180, 460)
    return {
      x0: L / 2 + hasard(-30, 30),
      y0: H * 0.38,
      vx: Math.cos(angle) * vitesse,
      vy: Math.sin(angle) * vitesse,
      rayon: hasard(3, 6.5),
      couleur: COULEURS_EAU[Math.floor(hasard(0, COULEURS_EAU.length))],
    }
  })

  animer(canvas, ctx, particules, DUREE, (c, p, s) => {
    const x = p.x0 + p.vx * s
    const y = p.y0 + p.vy * s + 0.5 * G * s * s
    if (y > H + 20) return
    c.save()
    c.globalAlpha = opacite(s, DUREE, 0.5) * 0.9
    c.fillStyle = p.couleur
    c.beginPath()
    c.arc(x, y, p.rayon, 0, Math.PI * 2)
    c.fill()
    c.restore()
  })
}
