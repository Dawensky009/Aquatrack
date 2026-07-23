import { Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * Bascule « masquer les montants ».
 *
 * Un oeil dans l'en-tete : d'un geste, les chiffres deviennent des points.
 * Pratique quand le telephone est pose sur le comptoir et que quelqu'un
 * regarde par-dessus l'epaule. Le choix est garde sur l'appareil.
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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-[background-color,transform] active:scale-95 hover:brightness-95"
      style={{ background: 'var(--surface)', color: 'var(--texte-doux)' }}
    >
      <Icone size={12} strokeWidth={2} />
      {caches ? 'Masqués' : 'Masquer'}
    </button>
  )
}
