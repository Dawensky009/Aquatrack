import { Calendar, Plus } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * En-tete d'ecran — motif de all_screen.png : grand titre a gauche, bouton
 * pilule blanc borde a droite (« This month 📅 »).
 *
 * Le bouton d'ajout vit ici sur grand ecran, et non dans la barre laterale.
 * Deux raisons :
 *
 *   1. Deux pilules pleine largeur empilees se disputaient l'attention —
 *      l'onglet actif perdait sa fonction d'indicateur de position au profit
 *      d'un bouton plus criard juste au-dessus.
 *   2. Sur ordinateur on consulte surtout ; la saisie se fait au comptoir, sur
 *      le telephone. L'emplacement le plus voyant du desktop revient donc a la
 *      navigation et a la synthese, pas a une action rare.
 *
 * Sur telephone il reste absent : le bouton flottant de la barre basse joue
 * deja ce role, sous le pouce.
 */
export default function EnTete({
  titre,
  sousTitre,
  periode,
  onPeriode,
  apres,
  avecAjout = true,
}) {
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)

  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-3">
        {/* `text-balance` plutot que `truncate` : un nom d'utilisateur long
            doit passer a la ligne, pas disparaitre derriere des points de
            suspension. Les boutons gardent leur largeur. */}
        <h1 className="titre-ecran min-w-0 flex-1 text-balance">{titre}</h1>

        <div className="flex shrink-0 items-center gap-2">
          {periode && (
            <button
              onClick={onPeriode}
              className="cible-tactile inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--bordure)' }}
            >
              {periode}
              <Calendar size={14} strokeWidth={1.75} style={{ color: 'var(--texte-doux)' }} />
            </button>
          )}

          {avecAjout && (
            <button
              onClick={() => ouvrirFeuille('choix')}
              className="cible-tactile hidden items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-transform active:scale-[0.98] lg:inline-flex"
              style={{ background: 'var(--accent)', color: 'var(--sur-accent)' }}
            >
              <Plus size={16} strokeWidth={2.25} />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {(sousTitre || apres) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {sousTitre && <p className="sous-ligne">{sousTitre}</p>}
          {apres}
        </div>
      )}
    </header>
  )
}
