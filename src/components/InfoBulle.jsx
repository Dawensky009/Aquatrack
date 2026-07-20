/**
 * Info-bulle des graphiques — le motif « $1210.6 » de all_screen.png.
 *
 * Detail repris de la reference : la pastille S'INVERSE selon le fond de la
 * carte. Sur la carte noire elle est blanche a texte noir, sur une carte
 * claire elle est noire a texte blanc. Sans cette inversion elle
 * disparaitrait dans l'un des deux cas.
 */
export default function InfoBulle({ actif, contenu, surSombre = false }) {
  if (!actif || !contenu) return null

  return (
    <div
      className="pointer-events-none rounded-[10px] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
      style={{
        background: surSombre ? 'var(--sur-hero)' : 'var(--action)',
        color: surSombre ? 'var(--hero)' : 'var(--sur-action)',
        boxShadow: 'var(--ombre-flottant)',
      }}
    >
      {contenu}
    </div>
  )
}
