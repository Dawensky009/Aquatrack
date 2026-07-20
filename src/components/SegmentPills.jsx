/**
 * Selecteur segmente — motif « All time / Weekly / Monthly » de
 * all_screen.png : piste claire, segment actif en pilule NOIRE a texte blanc.
 *
 * Sert partout : periodes des graphiques, filtres du journal, bascule
 * Vente/Depense et Forfait/Prix au gallon dans les feuilles de saisie.
 */
export default function SegmentPills({
  options,
  valeur,
  onChange,
  taille = 'normale',
  className = '',
}) {
  const compact = taille === 'compacte'

  return (
    <div
      role="tablist"
      className={`defile-x flex gap-1 rounded-full p-1 ${className}`}
      style={{ background: 'var(--surface-doux)' }}
    >
      {options.map((o) => {
        const actif = o.valeur === valeur
        return (
          <button
            key={o.valeur}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.valeur)}
            className={[
              'flex-1 shrink-0 rounded-full whitespace-nowrap transition-colors',
              compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[13px]',
              actif ? 'font-medium' : '',
            ].join(' ')}
            style={{
              background: actif ? 'var(--action)' : 'transparent',
              color: actif ? 'var(--sur-action)' : 'var(--texte-doux)',
            }}
          >
            {o.libelle}
          </button>
        )
      })}
    </div>
  )
}
