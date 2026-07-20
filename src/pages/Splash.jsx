import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { lireMeta, ecrireMeta } from '../lib/db.js'

/**
 * Ecran d'accueil.
 *
 * Vu une seule fois : au lancement suivant, on va droit au tableau de bord.
 * Une application qu'on ouvre chaque soir ne doit pas imposer un ecran
 * d'introduction a chaque fois.
 */
export default function Splash() {
  const naviguer = useNavigate()

  useEffect(() => {
    lireMeta('splash_vu', false).then((vu) => {
      if (vu) naviguer('/tableau-de-bord', { replace: true })
    })
  }, [naviguer])

  async function commencer() {
    await ecrireMeta('splash_vu', true)
    naviguer('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Illustration />

        <h1 className="mt-9 text-[30px] leading-tight font-medium tracking-tight">
          Aqua&nbsp;Track
        </h1>
        <p
          className="mt-3 max-w-[34ch] text-sm leading-relaxed"
          style={{ color: 'var(--texte-doux)' }}
        >
          Suivez vos ventes de gallons d'eau, gérez vos revenus et optimisez votre activité
          en un seul endroit.
        </p>
      </div>

      <button
        onClick={commencer}
        className="w-full max-w-[420px] rounded-full py-4 text-sm font-medium transition-transform active:scale-[0.99]"
        style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
      >
        Commencer
      </button>
    </div>
  )
}

/**
 * Illustration dessinee a la main en SVG : goutte d'eau et courbe
 * ascendante. Aucun asset externe — l'application doit pouvoir se charger
 * integralement hors-ligne, des le premier lancement.
 */
function Illustration() {
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" role="img" aria-label="Goutte d'eau et courbe de croissance">
      <defs>
        <linearGradient id="goutte" x1="90" y1="16" x2="90" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3F5" />
          <stop offset="1" stopColor="#2672DD" />
        </linearGradient>
      </defs>

      <circle cx="90" cy="90" r="80" fill="#FFFFFF" />

      {/* Goutte */}
      <path
        d="M90 20c0 0 34 38 34 60a34 34 0 1 1-68 0c0-22 34-60 34-60z"
        fill="url(#goutte)"
      />
      {/* Reflet : une seule touche, comme sur une vraie goutte */}
      <path
        d="M74 88a16 16 0 0 1 10-15"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".55"
      />

      {/* Courbe ascendante — l'activite qui progresse */}
      <path
        d="M34 146c14 0 20-12 32-12s16 10 28 10 22-20 34-20 12 6 18 6"
        stroke="#222026"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="146" cy="130" r="5" fill="#222026" />
    </svg>
  )
}
