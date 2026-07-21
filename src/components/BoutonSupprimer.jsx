import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'

/**
 * Suppression d'une ecriture, depuis la feuille qui la modifie.
 *
 * Deux gardes plutot qu'une seule, parce qu'un doigt sur un telephone ne vise
 * pas toujours juste et qu'une recette effacee par megarde ne se retrouve
 * nulle part :
 *
 *   - le bouton n'efface pas au premier appui, il demande confirmation sur
 *     place — pas de fenetre systeme qui masquerait ce qu'on s'apprete a
 *     perdre ;
 *   - le libelle de confirmation rappelle le montant exact.
 *
 * La suppression est LOGIQUE en base : la ligne est marquee, pas retiree, pour
 * que l'effacement atteigne aussi l'autre telephone du kiosque.
 */
export default function BoutonSupprimer({ libelle, recapitulatif, onConfirmer }) {
  const [demande, setDemande] = useState(false)
  const [enCours, setEnCours] = useState(false)

  if (!demande) {
    return (
      <button
        type="button"
        onClick={() => setDemande(true)}
        className="mt-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm transition-colors"
        style={{ background: 'var(--surface-doux)', color: 'var(--rouge)' }}
      >
        <Trash2 size={16} strokeWidth={1.75} />
        {libelle}
      </button>
    )
  }

  return (
    <div
      className="mt-1 flex flex-col gap-3 rounded-[16px] p-4"
      style={{ background: 'var(--rouge-clair)' }}
    >
      <p className="text-sm" style={{ color: 'var(--texte)' }}>
        {recapitulatif}
      </p>
      <p className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        Cette écriture disparaîtra aussi de l’autre téléphone du kiosque.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDemande(false)}
          disabled={enCours}
          className="flex-1 rounded-full py-2.5 text-sm disabled:opacity-50"
          style={{ background: 'var(--surface)', color: 'var(--texte-doux)' }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={async () => {
            setEnCours(true)
            try {
              await onConfirmer()
            } finally {
              setEnCours(false)
            }
          }}
          disabled={enCours}
          className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--rouge)', color: '#ffffff' }}
        >
          {enCours && <Loader2 size={15} className="animate-spin" />}
          Supprimer
        </button>
      </div>
    </div>
  )
}
