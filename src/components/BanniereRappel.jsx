import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { useStore, useEtat } from '../store/useStore.js'
import { doitAfficherBanniere } from '../lib/rappel.js'

/**
 * Rappel de cloture, dans l'application.
 *
 * C'est la couche SURE du rappel : elle ne depend d'aucune permission ni
 * d'aucun reseau. Des que l'application est ouverte apres l'heure choisie et
 * que la journee n'est pas close, elle le dit. La notification systeme, plus
 * fragile, vient en complement — jamais a sa place.
 *
 * Une horloge qui avance : l'app peut rester ouverte tout l'apres-midi, et la
 * banniere doit apparaitre quand l'heure passe, sans rechargement. On
 * reevalue chaque minute et au retour au premier plan — un telephone en veille
 * ne fait pas tourner ses minuteries.
 */
export default function BanniereRappel() {
  const { reglages, journees } = useEtat()
  const rappelRejetLe = useStore((s) => s.rappelRejetLe)
  const rejeterRappel = useStore((s) => s.rejeterRappel)
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)

  const [maintenant, setMaintenant] = useState(() => new Date())
  useEffect(() => {
    const tic = () => setMaintenant(new Date())
    const minuterie = setInterval(tic, 60_000)
    document.addEventListener('visibilitychange', tic)
    return () => {
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', tic)
    }
  }, [])

  const afficher = doitAfficherBanniere({
    actif: reglages.rappel_actif,
    heure: reglages.rappel_heure,
    journees,
    dernierRejet: rappelRejetLe,
    maintenant,
  })
  if (!afficher) return null

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-[16px] px-4 py-3"
      style={{ background: 'var(--hero)', color: 'var(--sur-hero)' }}
    >
      <BellRing size={18} strokeWidth={2} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Journée pas encore clôturée</p>
        <p className="text-[13px]" style={{ color: 'var(--sur-hero-doux)' }}>
          Enregistrez la recette d'aujourd'hui avant de fermer.
        </p>
      </div>
      <button
        onClick={() => ouvrirFeuille('cloture')}
        className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
        style={{ background: 'var(--sur-hero)', color: 'var(--hero)' }}
      >
        Clôturer
      </button>
      <button
        onClick={rejeterRappel}
        aria-label="Ignorer le rappel"
        className="-mr-1 shrink-0 p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
