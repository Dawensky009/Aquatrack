import { SlidersHorizontal, ArrowUpRight } from 'lucide-react'
import Delta from './Delta.jsx'

/**
 * Carte principale — le motif « Total Orders » / « Total Revenue » /
 * « Total Customers » de all_screen.png.
 *
 * Les trois variantes de la maquette :
 *   - noire : la statistique dominante de l'ecran
 *   - bleue : une statistique secondaire mise en avant
 *   - blanche : le cas courant
 *
 * C'est l'alternance noir / bleu / blanc qui donne son caractere a la
 * reference. Une app entierement bleue la raterait.
 */
export default function CarteHero({
  variante = 'blanche',
  titre,
  chiffre,
  delta,
  sousLigne,
  sousChiffres,
  action,
  onAction,
  // Controle libre pose dans le coin haut-droit (ex. l'oeil « masquer »).
  coin,
  children,
  className = '',
}) {
  const sombre = variante === 'noire' || variante === 'bleue'
  const fond =
    variante === 'noire' ? 'carte-noire' : variante === 'bleue' ? 'carte-bleue' : ''
  const Icone = action === 'lien' ? ArrowUpRight : SlidersHorizontal

  return (
    <section className={`carte ${fond} ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <h2 className="titre-carte">{titre}</h2>
        <div className="-m-2 flex items-center">
          {coin}
          {onAction && (
            <button
              onClick={onAction}
              aria-label="Options"
              className="p-2 opacity-60 transition-opacity hover:opacity-100"
            >
              <Icone size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </header>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="chiffre-hero">{chiffre}</span>
        <Delta valeur={delta} surSombre={sombre} />
      </div>

      {sousLigne && <p className="sous-ligne mt-1">{sousLigne}</p>}

      {/* Rangee de sous-chiffres : utilisee par la carte Benefice Net pour
          exposer Revenus et Depenses sans quitter la carte principale. */}
      {sousChiffres?.length > 0 && (
        <div className="mt-4 flex gap-6">
          {sousChiffres.map((s) => (
            <div key={s.libelle}>
              <p className="sous-ligne">{s.libelle}</p>
              <p className="chiffres mt-0.5 text-[17px] font-medium">{s.valeur}</p>
            </div>
          ))}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}
