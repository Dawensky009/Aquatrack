import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav.jsx'
import BarreLaterale from './components/BarreLaterale.jsx'
import GestionnaireFeuille from './components/GestionnaireFeuille.jsx'
import InviteInstallation from './components/InviteInstallation.jsx'
import EcranVerrou from './components/EcranVerrou.jsx'
import Splash from './pages/Splash.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Analytiques from './pages/Analytiques.jsx'
import Journal from './pages/Journal.jsx'
import Reglages from './pages/Reglages.jsx'
import { useStore } from './store/useStore.js'
import { demarrerSync } from './lib/sync.js'
import { suivreSysteme } from './lib/theme.js'

/**
 * Coquille de l'application.
 *
 * Un seul jeu d'ecrans pour toutes les tailles. Seul le chrome de navigation
 * change : barre basse + bouton flottant en dessous de 1024px, barre laterale
 * au-dela. Aucun composant n'est duplique — c'est la grille qui s'adapte.
 */
export default function App() {
  const initialiser = useStore((s) => s.initialiser)
  const rafraichirSync = useStore((s) => s.rafraichirSync)
  const themeSystemeChange = useStore((s) => s.themeSystemeChange)
  const applicationMasquee = useStore((s) => s.applicationMasquee)
  const evaluerVerrou = useStore((s) => s.evaluerVerrou)
  const verrouille = useStore((s) => s.verrouille)
  const pret = useStore((s) => s.pret)
  const { pathname } = useLocation()

  useEffect(() => {
    initialiser()
  }, [initialiser])

  useEffect(() => {
    if (!pret) return
    return demarrerSync(() => rafraichirSync())
  }, [pret, rafraichirSync])

  // En mode « système », l'app suit les changements de préférence de l'OS en
  // direct — sans avoir à être rechargée.
  useEffect(() => suivreSysteme(themeSystemeChange), [themeSystemeChange])

  // Verrouillage : on note l'instant où l'app passe en arrière-plan, et on
  // décide au retour. `visibilitychange` couvre aussi bien le changement
  // d'onglet que l'extinction de l'écran du téléphone.
  useEffect(() => {
    if (!pret) return
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') applicationMasquee()
      else evaluerVerrou()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => document.removeEventListener('visibilitychange', surVisibilite)
  }, [pret, applicationMasquee, evaluerVerrou])

  // Le splash occupe tout l'ecran : ni navigation ni gouttiere.
  const nu = pathname === '/'

  if (!pret) return <Chargement />

  // L'écran de verrouillage remplace l'application, il ne la recouvre pas :
  // rien du contenu ne doit être rendu, même caché derrière un voile.
  if (verrouille) return <EcranVerrou />

  return (
    <>
      {!nu && <BarreLaterale />}
      {!nu && <BottomNav />}

      <main
        className={nu ? '' : 'lg:pl-[260px]'}
        style={nu ? undefined : { paddingBottom: 'calc(var(--hauteur-nav) + 24px)' }}
      >
        <div className={nu ? '' : 'mx-auto w-full max-w-[480px] px-4 pt-5 md:max-w-[640px] lg:max-w-[1280px] lg:px-8'}>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/tableau-de-bord" element={<Dashboard />} />
            <Route path="/analytiques" element={<Analytiques />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/reglages" element={<Reglages />} />
            <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
          </Routes>
        </div>
      </main>

      <GestionnaireFeuille />
      {!nu && <InviteInstallation />}
    </>
  )
}

function Chargement() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-transparent"
        style={{ borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
        role="status"
        aria-label="Chargement"
      />
    </div>
  )
}
