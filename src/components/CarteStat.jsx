import Delta from './Delta.jsx'

/**
 * Mini-carte de statistique, utilisee par paires sous la carte principale.
 * Meme langage que CarteHero mais a mi-largeur : titre, chiffre, variation,
 * sous-ligne.
 */
export default function CarteStat({
  titre,
  chiffre,
  delta,
  sousLigne,
  alerte = false,
  icone: Icone,
  className = '',
}) {
  return (
    <section className={`carte flex flex-col justify-between ${className}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
          {titre}
        </h3>
        {Icone && (
          <Icone size={16} strokeWidth={1.75} style={{ color: 'var(--texte-tres-doux)' }} />
        )}
      </header>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="chiffre-stat">{chiffre}</span>
        <Delta valeur={delta} />
      </div>

      {sousLigne && (
        <p
          className="mt-1 text-xs"
          style={{
            // Une alerte (stock bas) passe en texte plein plutot qu'en gris :
            // c'est le seul moment ou cette sous-ligne doit attirer l'oeil.
            color: alerte ? 'var(--texte)' : 'var(--texte-doux)',
            fontWeight: alerte ? 500 : 400,
          }}
        >
          {sousLigne}
        </p>
      )}
    </section>
  )
}
