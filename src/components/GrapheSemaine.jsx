import { useState } from 'react'
import InfoBulle from './InfoBulle.jsx'
import { formatHTG } from '../lib/format.js'

/**
 * Activite par jour de la semaine — motif « matrice de points » de la carte
 * « Total Revenue » de all_screen.png : chaque jour est une colonne de petits
 * carres, remplis du bas jusqu'a la valeur, le reste en gris clair.
 *
 * Ecrit en SVG a la main plutot qu'avec Recharts : la forme est trop
 * particuliere pour un composant de librairie, et le rendu doit coller au
 * pixel a la reference.
 *
 * L'intervalle de 2px entre les carres est le « surface gap » : sans lui, la
 * colonne se lit comme une barre pleine et l'effet de trame disparait.
 */
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const NIVEAUX = 10
const COTE = 6
const ESPACE = 2

export default function GrapheSemaine({ donnees, jourActif = null }) {
  const [survole, setSurvole] = useState(null)
  if (!donnees?.length) return null

  // On compare des MOYENNES par journee saisie, pas des totaux : sinon une
  // journee oubliee ferait passer son jour de la semaine pour un jour creux.
  const max = Math.max(...donnees.map((d) => d.moyenne), 1)
  const hauteur = NIVEAUX * (COTE + ESPACE) - ESPACE

  return (
    <div>
      <div className="flex items-end justify-between gap-1">
        {donnees.map((d, i) => {
          const remplis = Math.round((d.moyenne / max) * NIVEAUX)
          const actif = i === jourActif || i === survole
          const couleur = actif ? 'var(--accent)' : 'var(--texte)'
          // Le nombre de journees est annonce : une moyenne fondee sur un
          // seul samedi ne vaut pas une moyenne fondee sur quatre.
          const legende =
            d.nb > 0
              ? `${formatHTG(d.moyenne)} en moyenne · ${d.nb} ${JOURS_LONGS[i]}${d.nb > 1 ? 's' : ''}`
              : 'aucune journée saisie'

          return (
            <div key={i} className="relative flex flex-1 flex-col items-center">
              {survole === i && (
                // L'info-bulle est plus large qu'une colonne : centree sur les
                // jours de bord, elle deborderait de la carte et serait coupee.
                // On l'ancre donc au bord le plus proche.
                <div
                  className="absolute -top-9 z-10"
                  style={
                    i <= 1
                      ? { left: 0 }
                      : i >= donnees.length - 2
                        ? { right: 0 }
                        : { left: '50%', transform: 'translateX(-50%)' }
                  }
                >
                  <InfoBulle actif contenu={legende} />
                </div>
              )}

              <svg
                width="100%"
                height={hauteur}
                viewBox={`0 0 ${COTE} ${hauteur}`}
                preserveAspectRatio="none"
                onMouseEnter={() => setSurvole(i)}
                onMouseLeave={() => setSurvole(null)}
                onTouchStart={() => setSurvole(i)}
                role="img"
                aria-label={`${JOURS_LONGS[i]} : ${legende}`}
                style={{ maxWidth: 26, cursor: 'pointer' }}
              >
                {Array.from({ length: NIVEAUX }, (_, n) => {
                  // n = 0 en bas : la colonne se remplit depuis la base.
                  const y = hauteur - (n + 1) * (COTE + ESPACE) + ESPACE
                  return (
                    <rect
                      key={n}
                      x={0}
                      y={y}
                      width={COTE}
                      height={COTE}
                      rx={1}
                      fill={n < remplis ? couleur : 'var(--gris-data)'}
                    />
                  )
                })}
              </svg>

              <span
                className="mt-2 text-[11px]"
                style={{ color: actif ? 'var(--texte)' : 'var(--texte-doux)' }}
              >
                {JOURS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
