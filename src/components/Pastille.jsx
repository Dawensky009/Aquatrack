/**
 * Pastille — le motif de tooltip de all_screen.png, reutilise comme alerte.
 *
 * Detail repris de la maquette : la pastille S'INVERSE selon son fond.
 * Sur une carte claire elle est noire a texte blanc ; sur la carte noire
 * elle est blanche a texte noir. C'est ce qui la garde lisible partout.
 *
 * Elle sert aussi d'alerte (hausse de prix, ecart de caisse, stock bas).
 * Le fort contraste du noir plein attire l'oeil sans introduire de rouge,
 * qui n'existe pas dans la planche de branding.
 */
export default function Pastille({
  children,
  surSombre = false,
  bloc = false,
  onClick,
  className = '',
}) {
  const Element = onClick ? 'button' : 'div'
  // Sur la carte hero (sombre dans les deux themes) la pastille est claire.
  // Ailleurs elle prend la couleur d'action, qui s'inverse avec le theme :
  // sombre en clair, claire en sombre — donc toujours contrastee.
  const fond = surSombre ? 'var(--sur-hero)' : 'var(--action)'
  const texte = surSombre ? 'var(--hero)' : 'var(--sur-action)'

  return (
    <Element
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 text-xs font-medium',
        'rounded-[10px] px-2.5 py-1.5',
        bloc ? 'flex w-full text-left' : '',
        onClick ? 'cible-tactile transition-transform active:scale-[0.98]' : '',
        className,
      ].join(' ')}
      style={{ background: fond, color: texte }}
    >
      {children}
    </Element>
  )
}
