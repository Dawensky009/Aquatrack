import { useState } from 'react'
import SegmentPills from './SegmentPills.jsx'
import Delta from './Delta.jsx'
import { formatHTG } from '../lib/format.js'
import * as M from '../lib/metrics.js'

/**
 * Comparaison des revenus — ce mois vs le mois dernier, cette année vs l'an
 * dernier.
 *
 * Le parti pris qui rend la comparaison honnête : « À DATE ÉGALE ». On ne
 * compare pas un mois entier à un mois à moitié écoulé — on arrête le passé au
 * même quantième que le présent. Sans ça, le début de mois paraîtrait toujours
 * catastrophique, et la fin toujours triomphale.
 */
const MODES = [
  { valeur: 'mois', libelle: 'Mois' },
  { valeur: 'annee', libelle: 'Année' },
]

export default function ComparaisonRevenus({ etat }) {
  const [mode, setMode] = useState('mois')

  const c = calcul(etat, mode)
  const delta = M.variationPct(c.actuel, c.precedent)
  const max = Math.max(c.actuel, c.precedent, 1)

  return (
    <section className="carte">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="titre-carte">Comparaison</h2>
          <p className="sous-ligne mt-0.5">Revenus, à date égale</p>
        </div>
        <SegmentPills
          taille="compacte"
          options={MODES}
          valeur={mode}
          onChange={setMode}
          className="w-auto"
        />
      </header>

      <div className="flex flex-col gap-3.5">
        <Barre libelle={c.libelleActuel} montant={c.actuel} max={max} couleur="var(--action)" />
        <Barre
          libelle={c.libellePrecedent}
          montant={c.precedent}
          max={max}
          couleur="var(--texte-tres-doux)"
        />
      </div>

      <p className="sous-ligne mt-4 flex flex-wrap items-center gap-1.5">
        {delta == null ? (
          `Aucun revenu ${mode === 'annee' ? "l'an dernier" : 'le mois dernier'} à la même date pour comparer.`
        ) : (
          <>
            <Delta valeur={delta} />
            {delta >= 0 ? 'de mieux' : 'de moins'} qu'à la même date{' '}
            {mode === 'annee' ? "l'an dernier" : 'le mois dernier'}.
          </>
        )}
      </p>
    </section>
  )
}

function Barre({ libelle, montant, max, couleur }) {
  // Plancher à 2 % : un tout petit revenu doit rester une barre visible, pas
  // un trait invisible qu'on prendrait pour zéro.
  const pct = montant > 0 ? Math.max(2, Math.round((montant / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
          {libelle}
        </span>
        <span className="chiffres text-sm font-medium">{formatHTG(montant)}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-doux)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: couleur }}
        />
      </div>
    </div>
  )
}

function calcul(etat, mode) {
  if (mode === 'annee') {
    return {
      actuel: M.totalRevenus(etat, M.anneeCouranteAuMemeJour()),
      precedent: M.totalRevenus(etat, M.anneePrecedenteAuMemeJour()),
      libelleActuel: 'Cette année',
      libellePrecedent: "L'an dernier",
    }
  }
  return {
    actuel: M.totalRevenus(etat, M.moisCourantAuMemeJour()),
    precedent: M.totalRevenus(etat, M.moisPrecedentAuMemeJour()),
    libelleActuel: 'Ce mois',
    libellePrecedent: 'Mois dernier',
  }
}
