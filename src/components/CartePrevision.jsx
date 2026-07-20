import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Truck, TriangleAlert } from 'lucide-react'
import InfoBulle from './InfoBulle.jsx'
import Pastille from './Pastille.jsx'
import EtatVide from './EtatVide.jsx'
import { formatHTG, formatDateAxe, formatDateCourte, formatGallons } from '../lib/format.js'

/**
 * Previsions de fin de mois et de rupture de stock.
 *
 * Deux partis pris qui gouvernent tout l'affichage :
 *
 *   1. Une FOURCHETTE, jamais un chiffre nu. Annoncer « vous ferez 62 340 HTG »
 *      serait une fausse precision : personne ne peut savoir cela. La borne
 *      basse est celle sur laquelle on peut s'engager.
 *
 *   2. La fiabilite est ecrite noir sur blanc. Sur trois jours d'historique,
 *      une projection ne vaut rien — le dire evite qu'on commande un camion
 *      sur la foi d'un chiffre inventé.
 */
const LIBELLES_FIABILITE = {
  bonne: 'Prévision fiable',
  moyenne: 'Prévision approximative',
  faible: 'Prévision peu fiable',
}

export default function CartePrevision({ prevision, rupture, serie }) {
  if (!prevision) {
    return (
      <section className="carte">
        <h2 className="titre-carte">Prévisions</h2>
        <EtatVide
          icone={TrendingUp}
          titre="Pas encore assez d'historique"
          texte="Clôturez quelques journées : l'app pourra alors projeter votre fin de mois et la date de votre prochaine commande."
        />
      </section>
    )
  }

  const f = prevision.fiabilite

  return (
    <section className="carte">
      <h2 className="titre-carte">Fin de mois estimée</h2>
      <p className="sous-ligne mt-0.5">
        {formatHTG(prevision.realise)} déjà encaissés ·{' '}
        {prevision.joursRestants.length} jour{prevision.joursRestants.length > 1 ? 's' : ''}{' '}
        restant{prevision.joursRestants.length > 1 ? 's' : ''}
      </p>

      <p className="chiffre-hero mt-2.5">{formatHTG(prevision.total)}</p>
      <p className="sous-ligne mt-0.5">
        entre {formatHTG(prevision.bas)} et {formatHTG(prevision.haut)}
      </p>

      {serie?.length > 0 && (
        <div className="mt-4" style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="degrade-prevision" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical horizontal={false} stroke="var(--bordure)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateAxe}
                tick={{ fontSize: 11, fill: 'var(--texte-doux)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis hide domain={[0, 'dataMax']} />

              <Tooltip
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  const p = payload?.[0]?.payload
                  if (!p) return null
                  const projete = p.realise == null
                  return (
                    <InfoBulle
                      actif={active}
                      contenu={`${formatDateCourte(label)} · ${formatHTG(
                        projete ? p.projete : p.realise,
                      )}${projete ? ' (estimé)' : ''}`}
                    />
                  )
                }}
              />

              {/* Le trait plein s'arrete a aujourd'hui, le pointille prend la
                  suite : la difference entre constate et estime doit se voir
                  sans avoir a lire une legende. */}
              <Area
                type="monotone"
                dataKey="realise"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#degrade-prevision)"
                dot={false}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="projete"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="sous-ligne mt-2 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-4 rounded-full"
          style={{ background: 'var(--accent)' }}
        />
        réalisé
        <span
          aria-hidden="true"
          className="ml-2 inline-block h-0.5 w-4 rounded-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 8px)',
          }}
        />
        estimé
      </p>

      {/* --- Fiabilite, dite franchement --------------------------------- */}
      <p
        className="mt-4 text-xs"
        style={{ color: f.niveau === 'bonne' ? 'var(--texte-doux)' : 'var(--texte)' }}
      >
        {LIBELLES_FIABILITE[f.niveau]} — {f.nb} journée{f.nb > 1 ? 's' : ''} observée
        {f.nb > 1 ? 's' : ''}
        {f.raison ? `, ${f.raison}` : ''}.
      </p>

      {/* --- Rupture de stock --------------------------------------------- */}
      {rupture?.jours != null && (
        <div className="mt-4">
          <Pastille bloc>
            {rupture.urgent ? (
              <TriangleAlert size={14} strokeWidth={2} className="shrink-0" />
            ) : (
              <Truck size={14} strokeWidth={2} className="shrink-0" />
            )}
            <span>
              {rupture.stock <= 0
                ? 'Citerne vide — commandez un camion'
                : rupture.urgent
                  ? `Citerne vide dans ${rupture.jours} jour${rupture.jours > 1 ? 's' : ''} — commandez maintenant`
                  : `Commandez avant le ${formatDateCourte(rupture.dateCommande)} · citerne vide vers le ${formatDateCourte(rupture.date)}`}
            </span>
          </Pastille>
          {rupture.stock > 0 && (
            <p className="sous-ligne mt-2">
              {formatGallons(rupture.stock)} en citerne, au rythme des dernières semaines.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
