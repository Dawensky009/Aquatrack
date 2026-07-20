import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import InfoBulle from './InfoBulle.jsx'
import { formatPrix, formatDateAxe, formatDateCourte, formatGallons } from '../lib/format.js'

/**
 * Evolution du prix d'approvisionnement.
 *
 * Trace EN ESCALIER (`stepAfter`), et c'est le point important : entre deux
 * livraisons, le prix ne bouge pas. Une courbe lissee dessinerait une
 * progression continue qui n'a jamais eu lieu — elle mentirait sur la donnee.
 * L'escalier montre exactement ce qui s'est passe : un palier, puis un saut
 * le jour ou la compagnie a change son tarif.
 *
 * Chaque livraison porte un point visible : ce sont les seuls moments ou une
 * decision a ete prise.
 */
export default function GraphePrixAppro({ historique, hauteur = 150 }) {
  if (!historique?.length) return null

  // Un seul achat ne fait pas une courbe : on double le point pour tracer un
  // palier lisible plutot qu'un point isole au milieu du vide.
  const donnees =
    historique.length === 1
      ? [historique[0], { ...historique[0], date: historique[0].date + ' ' }]
      : historique

  const trait = 'var(--accent)'
  const encre = 'var(--texte-doux)'

  const pas = Math.max(1, Math.floor(donnees.length / 4))
  const reperes = donnees.filter((_, i) => i % pas === 0).map((d) => d.date)

  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={donnees} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical horizontal={false} stroke="var(--bordure)" strokeDasharray="2 4" />

          <XAxis
            dataKey="date"
            ticks={reperes}
            tickFormatter={(d) => formatDateAxe(d.trim())}
            tick={{ fontSize: 11, fill: encre }}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
          />
          {/* Echelle resserree autour des valeurs : sur des prix de 7 a 8 HTG,
              partir de zero ecraserait la variation qu'on cherche a montrer.
              Legitime ici — c'est une serie de prix, pas des barres de volume. */}
          <YAxis hide domain={['dataMin - 0.5', 'dataMax + 0.5']} />

          <Tooltip
            cursor={{ stroke: trait, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload
              return (
                <InfoBulle
                  actif={active}
                  contenu={
                    p &&
                    `${formatDateCourte(p.date.trim())} · ${formatPrix(p.coutGallon)}/gallon · ${formatGallons(p.gallons)}`
                  }
                />
              )
            }}
          />

          <Line
            type="stepAfter"
            dataKey="coutGallon"
            stroke={trait}
            strokeWidth={2}
            dot={{ r: 3.5, fill: trait, strokeWidth: 2, stroke: '#FFFFFF' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
