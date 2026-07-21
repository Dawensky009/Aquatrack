import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { formatHTG } from '../lib/format.js'
import { couleurDonnees } from '../lib/theme.js'
import { useSombre } from '../store/useStore.js'

/**
 * Donut « Ou part votre argent » — motif « Top categories » de
 * all_screen.png : segments a rayons variables, pourcentage POSE SUR le
 * segment, total au centre, legende a pastilles en dessous.
 *
 * Deux exigences d'accessibilite tenues ici :
 *
 *   - Le cyan de la marque ne passe pas le seuil de contraste de 1,79:1 sur
 *     fond blanc. La regle est alors d'apporter un « relief » : chaque
 *     segment porte son pourcentage EN CLAIR et la legende repete le montant.
 *     L'identite n'est donc jamais portee par la couleur seule.
 *   - Un intervalle de 2px separe les segments (`paddingAngle`), sinon deux
 *     teintes voisines se lisent comme une seule masse.
 */
export default function DonutCategories({
  parts: brutes,
  total,
  taille = 200,
  libelleCentre = 'encaissé',
}) {
  const [actif, setActif] = useState(null)
  const sombre = useSombre()

  // Les couleurs sont transposees a l'affichage, jamais reecrites en base :
  // le noir de marque serait invisible sur une carte sombre.
  const parts = useMemo(
    () => (brutes ?? []).map((p) => ({ ...p, couleur: couleurDonnees(p.couleur, sombre) })),
    [brutes, sombre],
  )

  if (!parts.length || total <= 0) return null

  const rayonExterne = taille / 2 - 16
  const rayonInterne = rayonExterne * 0.62

  return (
    <div>
      <div className="relative mx-auto" style={{ width: taille, height: taille }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={parts}
              dataKey="montant"
              nameKey="nom"
              innerRadius={rayonInterne}
              outerRadius={rayonExterne}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              onMouseEnter={(_, i) => setActif(i)}
              onMouseLeave={() => setActif(null)}
              /* Le pourcentage est pose SUR le segment, comme dans la
                 reference — et c'est aussi ce qui rend le graphique lisible
                 sans dependre de la couleur.

                 Les x/y fournis par Recharts pointent a l'EXTERIEUR du
                 camembert : on recalcule donc le milieu de l'anneau a partir
                 de l'angle median, sinon les etiquettes flottent a cote du
                 graphique au lieu d'etre dessus. */
              label={({ cx, cy, midAngle, innerRadius: ri, outerRadius: ro, percent, index }) => {
                // En dessous de 8 %, le segment est trop etroit pour porter
                // son etiquette lisiblement. La legende, elle, donne toujours
                // le pourcentage exact — aucune information n'est perdue.
                if (percent < 0.08) return null
                const rad = -midAngle * (Math.PI / 180)
                const r = ri + (ro - ri) / 2
                return (
                  <text
                    x={cx + r * Math.cos(rad)}
                    y={cy + r * Math.sin(rad)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fontSize: 11, fontWeight: 500, pointerEvents: 'none' }}
                    fill={lisibleSur(parts[index].couleur)}
                  >
                    {Math.round(percent * 100)} %
                  </text>
                )
              }}
              labelLine={false}
            >
              {parts.map((p, i) => (
                <Cell
                  key={p.nom}
                  fill={p.couleur}
                  /* Le segment survole ressort par un leger agrandissement
                     plutot que par un changement de teinte : la couleur reste
                     attachee a l'entite, jamais a son etat. */
                  style={{
                    transform: actif === i ? 'scale(1.04)' : 'none',
                    transformOrigin: 'center',
                    transition: 'transform .15s ease-out',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="chiffres text-[17px] leading-tight font-medium">
              {formatHTG(actif != null ? parts[actif].montant : total)}
            </p>
            <p className="sous-ligne mt-0.5 max-w-[9ch] truncate">
              {actif != null ? parts[actif].nom : libelleCentre}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {parts.map((p, i) => (
          <li
            key={p.nom}
            onMouseEnter={() => setActif(i)}
            onMouseLeave={() => setActif(null)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.couleur, outline: '1px solid rgb(0 0 0 / .06)' }}
            />
            <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--texte-doux)' }}>
              {p.nom}
            </span>
            <span className="chiffres shrink-0 font-medium">{formatHTG(p.montant)}</span>
            <span className="chiffres w-10 shrink-0 text-right" style={{ color: 'var(--texte-doux)' }}>
              {Math.round((p.montant / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Choisit l'encre du pourcentage selon la clarte du segment. */
function lisibleSur(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#222026' : '#FFFFFF'
}
