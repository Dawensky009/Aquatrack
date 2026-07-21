/**
 * En-tete de carte de reglage, avec pastille d'icone.
 *
 * Partage plutot que redefini dans chaque ecran : une carte qui porterait son
 * titre sans icone, au milieu de cartes qui en ont une, se lirait comme un
 * oubli. Dans un panneau de reglages la constance vaut mieux que la variete.
 *
 * L'icone n'est pas un ornement : sur un ecran ou tout se ressemble, c'est
 * elle qu'on reconnait en balayant du pouce, avant meme d'avoir lu le titre.
 */
export default function EnTeteCarte({ icone: Icone, titre }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-[10px]"
        style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
      >
        <Icone size={17} strokeWidth={1.75} />
      </span>
      <h2 className="titre-carte">{titre}</h2>
    </div>
  )
}
