import { Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * Bascule « masquer les montants » — un simple oeil.
 *
 * Pose dans le coin de la carte Benefice : d'un geste, les chiffres deviennent
 * des points, quand le telephone est sur le comptoir et qu'on regarde par
 * dessus l'epaule. Sans libelle : l'icone parle d'elle-meme, et l'etat se lit
 * sur le tableau (chiffres ou points). Le choix est garde sur l'appareil.
 *
 * Aucune couleur imposee : le bouton herite de l'encre de son parent
 * (`currentColor`), donc il reste lisible sur la carte bleue comme ailleurs.
 */
export default function BoutonMasque() {
  const caches = useStore((s) => s.montantsCaches)
  const basculer = useStore((s) => s.basculerMontants)
  const Icone = caches ? EyeOff : Eye

  return (
    <button
      type="button"
      onClick={basculer}
      aria-pressed={caches}
      aria-label={caches ? 'Afficher les montants' : 'Masquer les montants'}
      title={caches ? 'Afficher les montants' : 'Masquer les montants'}
      className="p-2 opacity-70 transition-opacity hover:opacity-100"
    >
      <Icone size={18} strokeWidth={1.75} />
    </button>
  )
}
