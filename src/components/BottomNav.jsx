import { NavLink } from 'react-router-dom'
import { Home, ChartNoAxesColumn, ScrollText, Settings, Plus } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * Barre de navigation basse — motif de all_screen.png : fond blanc, filet
 * en haut, icones fines surmontant un libelle, onglet actif en noir plein.
 *
 * Ecart assume par rapport a la reference : elle a cinq onglets plats, ici
 * l'emplacement central accueille un bouton d'action. C'est justifie —
 * saisir une operation est la seule action quotidienne de l'app, et la
 * placer sous le pouce vaut mieux que de la cacher dans un ecran.
 *
 * Masquee au-dela de 1024px, ou BarreLaterale prend le relais.
 */
const ONGLETS = [
  { to: '/tableau-de-bord', libelle: 'Accueil', icone: Home },
  { to: '/analytiques', libelle: 'Analytiques', icone: ChartNoAxesColumn },
  null, // emplacement du bouton central
  { to: '/journal', libelle: 'Journal', icone: ScrollText },
  { to: '/reglages', libelle: 'Réglages', icone: Settings },
]

export default function BottomNav() {
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--bordure)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="mx-auto flex max-w-[480px] items-end justify-around px-2 pt-2 pb-1.5">
        {ONGLETS.map((o, i) =>
          o ? (
            <li key={o.to} className="flex-1">
              <NavLink
                to={o.to}
                className="flex flex-col items-center gap-1 py-1 transition-colors duration-150 active:opacity-60"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--texte)' : 'var(--texte-doux)',
                })}
              >
                {({ isActive }) => (
                  <>
                    {/* L'icone se souleve d'un cheveu quand l'onglet devient
                        actif : le doigt a touche, quelque chose a bouge. */}
                    <o.icone
                      size={22}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      className="transition-transform duration-200 ease-out"
                      style={{ transform: isActive ? 'translateY(-1px)' : 'none' }}
                    />
                    <span
                      className="text-[11px]"
                      style={{ fontWeight: isActive ? 500 : 400 }}
                    >
                      {o.libelle}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ) : (
            <li key="fab" className="flex flex-1 justify-center">
              <button
                onClick={() => ouvrirFeuille('choix')}
                aria-label="Ajouter une opération"
                className="grid size-14 -translate-y-4 place-items-center rounded-full transition-transform active:scale-95"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--sur-accent)',
                  boxShadow: 'var(--ombre-flottant)',
                }}
              >
                <Plus size={26} strokeWidth={2} />
              </button>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
