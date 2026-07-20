/**
 * Etat vide.
 *
 * Utilise partout ou un calcul renvoie `null` faute de donnees — notamment
 * la marge tant qu'aucun reapprovisionnement n'a ete saisi. Afficher « — »
 * ou « 0 HTG » laisserait croire a une marge nulle ; il faut dire ce qui
 * manque et comment y remedier.
 */
export default function EtatVide({ icone: Icone, titre, texte, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-4 py-8 text-center ${className}`}>
      {Icone && (
        <span
          className="mb-3 grid size-12 place-items-center rounded-full"
          style={{ background: 'var(--surface-doux)', color: 'var(--texte-tres-doux)' }}
        >
          <Icone size={22} strokeWidth={1.5} />
        </span>
      )}
      <p className="text-sm font-medium">{titre}</p>
      {texte && (
        <p className="mt-1 max-w-[38ch] text-xs" style={{ color: 'var(--texte-doux)' }}>
          {texte}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
