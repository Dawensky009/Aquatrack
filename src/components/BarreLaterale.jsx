import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home,
  ChartNoAxesColumn,
  ScrollText,
  Settings,
  Droplet,
  Lock,
  Sun,
  Moon,
  MonitorSmartphone,
} from 'lucide-react'
import { useStore, useEtat } from '../store/useStore.js'
import BadgeSync from './BadgeSync.jsx'
import * as M from '../lib/metrics.js'
import { formatHTG } from '../lib/format.js'

/**
 * Navigation laterale — desktop (>= 1024px).
 *
 * Les references ne couvrent que le mobile : cette barre est une extension.
 * Elle reprend le meme vocabulaire — pilule noire pour l'element actif, bleu
 * pour l'action principale, icones fines.
 *
 * Elle porte aussi une synthese du mois. Sur un grand ecran, quatre entrees de
 * menu laissaient plusieurs centaines de pixels de vide ; le remplir par une
 * information utile vaut mieux que d'etirer le menu artificiellement. Les
 * chiffres essentiels restent alors visibles depuis n'importe quel ecran.
 */
const ONGLETS = [
  { to: '/tableau-de-bord', libelle: 'Accueil', icone: Home },
  { to: '/analytiques', libelle: 'Analytiques', icone: ChartNoAxesColumn },
  { to: '/journal', libelle: 'Journal', icone: ScrollText },
  { to: '/reglages', libelle: 'Réglages', icone: Settings },
]

const THEMES = [
  { valeur: 'light', icone: Sun, titre: 'Thème clair' },
  { valeur: 'dark', icone: Moon, titre: 'Thème sombre' },
  { valeur: 'system', icone: MonitorSmartphone, titre: 'Suivre le système' },
]

export default function BarreLaterale() {
  const etat = useEtat()
  const themeMode = useStore((s) => s.themeMode)
  const changerTheme = useStore((s) => s.changerTheme)
  const applicationMasquee = useStore((s) => s.applicationMasquee)

  const resume = useMemo(() => {
    const mois = M.moisCourant()
    return {
      net: M.beneficeNet(etat, mois),
      stock: M.gallonsEnStock(etat),
      jours: M.joursDeStock(etat),
    }
  }, [etat])

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col lg:flex"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--bordure)' }}
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-5">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-[10px]"
            style={{ background: 'var(--accent)', color: 'var(--sur-accent)' }}
          >
            <Droplet size={19} strokeWidth={2} fill="currentColor" />
          </span>
          <span className="text-[15px] leading-tight font-medium">
            Aqua Track
            <span className="block text-[11px]" style={{ color: 'var(--texte-doux)' }}>
              Gestion de kiosque
            </span>
          </span>
        </div>

        {/* Aucun bouton d'action ici : il vit desormais dans l'en-tete de
            page. Deux pilules pleine largeur empilees se disputaient
            l'attention, et l'onglet actif y perdait son role d'indicateur de
            position. La barre laterale ne fait plus que naviguer et informer. */}
        <nav>
          <ul className="flex flex-col gap-1">
            {ONGLETS.map((o) => (
              <li key={o.to}>
                <NavLink
                  to={o.to}
                  // Le fond actif reste en ligne, mais PAS le fond inactif :
                  // un style en ligne bat toujours une classe, et « transparent »
                  // aurait annule le survol.
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-[background-color,color] duration-200 ease-out ${
                      isActive ? '' : 'hover:bg-[var(--surface-doux)]'
                    }`
                  }
                  style={({ isActive }) => ({
                    background: isActive ? 'var(--action)' : undefined,
                    color: isActive ? 'var(--sur-action)' : 'var(--texte-doux)',
                    fontWeight: isActive ? 500 : 400,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <o.icone size={19} strokeWidth={isActive ? 2.25 : 1.75} />
                      {o.libelle}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* --- Synthese du mois -------------------------------------------- */}
        <section className="mt-6 rounded-[16px] p-4" style={{ background: 'var(--surface-doux)' }}>
          <p className="text-[11px] tracking-wide uppercase" style={{ color: 'var(--texte-doux)' }}>
            Ce mois
          </p>
          <p className="chiffres mt-1.5 text-[22px] leading-none font-medium">
            {formatHTG(resume.net)}
          </p>
          <p className="sous-ligne mt-1">bénéfice net</p>

          <div
            className="mt-3.5 flex items-baseline justify-between gap-2 pt-3.5"
            style={{ borderTop: '1px solid var(--bordure)' }}
          >
            <span className="sous-ligne">En stock</span>
            <span className="chiffres text-sm font-medium">
              {Math.round(resume.stock).toLocaleString('fr-FR')} gal
            </span>
          </div>
          {resume.jours != null && (
            <p
              className="mt-0.5 text-right text-[11px]"
              style={{
                // Sous trois jours d'autonomie, la ligne passe en texte plein :
                // c'est le seul moment ou elle doit accrocher l'oeil.
                color: resume.jours < 3 ? 'var(--texte)' : 'var(--texte-doux)',
                fontWeight: resume.jours < 3 ? 500 : 400,
              }}
            >
              {resume.stock <= 0 ? 'Citerne vide' : `~${Math.round(resume.jours)} jours restants`}
            </p>
          )}
        </section>

        <div className="flex-1" />
      </div>

      {/* --- Pied : actions rapides --------------------------------------- */}
      <div className="p-5 pt-4" style={{ borderTop: '1px solid var(--bordure)' }}>
        {etat.reglages.verrou_actif && (
          <button
            onClick={() => {
              // Verrouille sur-le-champ, sans attendre le delai configure :
              // c'est le geste qu'on fait en quittant le comptoir.
              applicationMasquee()
              useStore.setState({ verrouille: true })
            }}
            className="mb-3 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] transition-colors"
            style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
          >
            <Lock size={15} strokeWidth={1.75} />
            Verrouiller maintenant
          </button>
        )}

        <div className="flex items-center justify-between gap-2">
          <BadgeSync />

          <div
            className="flex gap-0.5 rounded-full p-0.5"
            style={{ background: 'var(--surface-doux)' }}
          >
            {THEMES.map((t) => {
              const actif = themeMode === t.valeur
              return (
                <button
                  key={t.valeur}
                  onClick={() => changerTheme(t.valeur)}
                  title={t.titre}
                  aria-label={t.titre}
                  aria-pressed={actif}
                  className="grid size-7 place-items-center rounded-full transition-colors"
                  style={{
                    background: actif ? 'var(--action)' : 'transparent',
                    color: actif ? 'var(--sur-action)' : 'var(--texte-doux)',
                  }}
                >
                  <t.icone size={13} strokeWidth={2} />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
