import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import InfoBulle from './InfoBulle.jsx'
import { formatHTG, formatDateAxe, formatDateCourte, formatMoisAnnee } from '../lib/format.js'

/**
 * Courbe d'evolution — motif de la carte « Total Orders » de all_screen.png :
 * trait fin, gridlines VERTICALES en pointille, pas de grille horizontale,
 * quelques reperes d'axe seulement.
 *
 * Une seule serie : pas de legende, le titre de la carte la nomme deja.
 */
export default function GrapheRevenus({
  donnees,
  cle = 'revenus',
  surSombre = false,
  hauteur = 150,
  parMois = false,
}) {
  if (!donnees?.length) return null

  const trait = surSombre ? '#FFFFFF' : 'var(--accent)'
  const grille = surSombre ? 'var(--sur-hero-faible)' : 'var(--bordure)'
  const encre = surSombre ? 'var(--sur-hero-doux)' : 'var(--texte-doux)'
  const idDegrade = `degrade-${cle}-${surSombre ? 'sombre' : 'clair'}`

  // Quatre a cinq reperes suffisent : la maquette en montre cinq sur 30 jours.
  const pas = Math.max(1, Math.floor(donnees.length / 4))
  const reperes = donnees.filter((_, i) => i % pas === 0).map((d) => d.date)

  const etiquette = parMois ? formatMoisAnnee : formatDateCourte

  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={donnees} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trait} stopOpacity={surSombre ? 0.28 : 0.18} />
              <stop offset="100%" stopColor={trait} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical
            horizontal={false}
            stroke={grille}
            strokeDasharray="2 4"
          />

          <XAxis
            dataKey="date"
            ticks={reperes}
            tickFormatter={parMois ? (d) => formatMoisAnnee(d).slice(0, 4) : formatDateAxe}
            tick={{ fontSize: 11, fill: encre }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          {/* Le domaine suit les donnees plutot que d'etre fixe a zero : un
              benefice cumule negatif doit rester visible, pas etre ecrete au
              ras de l'axe comme s'il valait zero. */}
          <YAxis hide domain={['dataMin', 'dataMax']} />

          <Tooltip
            cursor={{ stroke: trait, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => (
              <InfoBulle
                actif={active}
                surSombre={surSombre}
                contenu={
                  payload?.[0] &&
                  `${etiquette(label)} · ${formatHTG(payload[0].value)}`
                }
              />
            )}
          />

          <Area
            type="monotone"
            dataKey={cle}
            stroke={trait}
            strokeWidth={2}
            fill={`url(#${idDegrade})`}
            /* 8px minimum au survol : la cible doit rester attrapable au doigt. */
            activeDot={{ r: 4, strokeWidth: 2, stroke: surSombre ? '#222026' : '#FFFFFF' }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
