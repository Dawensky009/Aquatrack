import { Truck, ChevronRight } from 'lucide-react'
import EtatVide from './EtatVide.jsx'
import Pastille from './Pastille.jsx'
import { useStore } from '../store/useStore.js'
import { formatHTG, formatPrix, formatGallons, formatDateCourte } from '../lib/format.js'

/**
 * Rendement de chaque camion.
 *
 * Repond a la question que la marge moyenne ne peut pas trancher : « ce
 * camion-la, il m'a rapporte combien ? ». Chaque livraison est suivie de son
 * arrivee a son epuisement — gallons ecoules, revenu genere, marge reelle et
 * duree d'ecoulement.
 *
 * La barre de progression rend le camion en cours immediatement lisible : on
 * voit d'un coup d'oeil s'il reste de quoi tenir la semaine.
 */
export default function SuiviLots({ suivi, limite = 5 }) {
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)

  if (!suivi?.lots?.length) {
    return (
      <EtatVide
        icone={Truck}
        titre="Aucun approvisionnement"
        texte="Saisissez un achat de camion pour suivre ce que chaque livraison vous rapporte."
      />
    )
  }

  const lots = suivi.lots.slice(0, limite)
  const masques = suivi.lots.length - lots.length

  return (
    <div className="flex flex-col gap-4">
      {lots.map((l) => (
        <Lot key={l.id} lot={l} onOuvrir={() => ouvrirFeuille('lot', { id: l.id })} />
      ))}

      {/* Une liste tronquee sans mention se lirait comme un historique
          complet. On dit toujours ce qui n'est pas montre. */}
      {masques > 0 && (
        <p className="sous-ligne">
          {masques} livraison{masques > 1 ? 's' : ''} plus ancienne
          {masques > 1 ? 's' : ''} non affichée{masques > 1 ? 's' : ''}.
        </p>
      )}

      {/* Le stock anterieur a l'installation de l'app ne peut etre rattache a
          aucun camion. Le taire donnerait des totaux qui ne tombent pas juste. */}
      {suivi.nonAttribue > 1 && (
        <Pastille bloc>
          {formatGallons(suivi.nonAttribue)} vendus ne sont rattachés à aucun camion
          enregistré ({formatHTG(suivi.revenuNonAttribue)}). C'est normal si vous aviez
          déjà du stock avant d'utiliser l'application.
        </Pastille>
      )}
    </div>
  )
}

const ETIQUETTES = {
  'en-cours': 'En cours',
  epuise: 'Épuisé',
  'en-attente': 'Pas encore entamé',
}

function Lot({ lot, onOuvrir }) {
  const enCours = lot.statut === 'en-cours'
  const pourcent = Math.round(lot.part * 100)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOuvrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOuvrir())}
      className="cursor-pointer transition-opacity active:opacity-60"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-1 text-sm font-medium">
          <span className="truncate">Camion du {formatDateCourte(lot.date)}</span>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className="shrink-0"
            style={{ color: 'var(--texte-tres-doux)' }}
          />
        </h3>
        <span className="chiffres shrink-0 text-sm font-medium">
          {lot.vendus > 0 ? formatHTG(lot.marge) : '—'}
        </span>
      </header>

      <p className="sous-ligne mt-0.5">
        {formatGallons(lot.gallons)} à {formatPrix(lot.coutGallon)} ·{' '}
        {lot.vendus > 0 ? `${formatHTG(lot.revenu)} encaissés` : ETIQUETTES[lot.statut]}
      </p>

      {/* Barre d'ecoulement : le remplissage represente ce qui est vendu. */}
      <div
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-doux)' }}
        role="img"
        aria-label={`${pourcent} % écoulé`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.min(100, pourcent)}%`,
            background: enCours ? 'var(--accent)' : 'var(--action)',
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs" style={{ color: 'var(--texte-doux)' }}>
          {pourcent} % écoulé
          {lot.restant > 1 && ` · ${formatGallons(lot.restant)} restants`}
        </span>
        <span className="text-xs" style={{ color: 'var(--texte-doux)' }}>
          {lot.margeParGallon != null && `${formatPrix(lot.margeParGallon)}/gallon`}
          {lot.jours != null && ` · ${lot.jours} j`}
        </span>
      </div>
    </article>
  )
}
