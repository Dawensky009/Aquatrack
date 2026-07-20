import { formatPourcent } from '../lib/format.js'

/**
 * Indicateur de variation : « ↗ +21 % » / « ↘ 10 % ».
 *
 * Volontairement NON colore. Dans all_screen.png les variations sont
 * toujours en gris discret a cote du grand chiffre, jamais en vert ou en
 * rouge — c'est ce qui donne son calme a la maquette. Le sens est porte par
 * la fleche, pas par la couleur.
 */
export default function Delta({ valeur, surSombre = false, className = '' }) {
  if (valeur == null || !Number.isFinite(valeur)) return null

  const monte = valeur > 0
  const plat = Math.abs(valeur) < 0.05
  const couleur = surSombre ? 'var(--sur-hero-doux)' : 'var(--texte-doux)'

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${className}`}
      style={{ color: couleur }}
    >
      <span aria-hidden="true">{plat ? '→' : monte ? '↗' : '↘'}</span>
      <span className="chiffres">{formatPourcent(valeur, { signe: monte })}</span>
    </span>
  )
}
