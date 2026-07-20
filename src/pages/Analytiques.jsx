import { useMemo, useState } from 'react'
import { Warehouse, TrendingUp, Truck, PieChart } from 'lucide-react'
import EnTete from '../components/EnTete.jsx'
import CarteHero from '../components/CarteHero.jsx'
import CarteStat from '../components/CarteStat.jsx'
import BarreSplit from '../components/BarreSplit.jsx'
import SegmentPills from '../components/SegmentPills.jsx'
import EtatVide from '../components/EtatVide.jsx'
import GrapheRevenus from '../components/GrapheRevenus.jsx'
import GrapheSemaine from '../components/GrapheSemaine.jsx'
import GraphePrixAppro from '../components/GraphePrixAppro.jsx'
import DonutCategories from '../components/DonutCategories.jsx'
import SuiviLots from '../components/SuiviLots.jsx'
import CartePrevision from '../components/CartePrevision.jsx'
import { usePeriode } from '../components/FeuillePeriode.jsx'
import { useStore, useEtat } from '../store/useStore.js'
import * as M from '../lib/metrics.js'
import { formatHTG, formatPrix, formatGallons } from '../lib/format.js'

const PERIODES = [
  { valeur: '7j', libelle: '7 jours' },
  { valeur: '30j', libelle: '30 jours' },
  { valeur: '12m', libelle: '12 mois' },
]

export default function Analytiques() {
  const etat = useEtat()
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)
  const periodeGlobale = usePeriode()
  const [fenetre, setFenetre] = useState('30j')

  const c = useMemo(
    () => calculer(etat, fenetre, periodeGlobale),
    [etat, fenetre, periodeGlobale],
  )

  return (
    <>
      <EnTete
        titre="Analytiques"
        periode={periodeGlobale.libelle}
        onPeriode={() => ouvrirFeuille('periode')}
      />

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {/* Benefice net + activite par jour de la semaine */}
        <CarteHero
          titre="Bénéfice Net"
          chiffre={formatHTG(c.benefice)}
          delta={c.deltaBenefice}
          sousLigne={
            c.beneficePrecedent != null
              ? `${formatHTG(c.beneficePrecedent)} à la même date le mois dernier`
              : c.libellePeriode
          }
          className="lg:col-span-2"
        >
          <GrapheSemaine donnees={c.semaine} jourActif={c.jourActuel} />
        </CarteHero>

        {/* Previsions */}
        <CartePrevision prevision={c.prevision} rupture={c.rupture} serie={c.seriePrevision} />

        {/* Revenus dans le temps */}
        <section className="carte lg:col-span-2">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="titre-carte">Revenus</h2>
            <SegmentPills
              taille="compacte"
              options={PERIODES}
              valeur={fenetre}
              onChange={setFenetre}
              className="w-auto"
            />
          </header>
          <GrapheRevenus
            donnees={c.serie}
            cle="revenus"
            hauteur={170}
            parMois={fenetre === '12m'}
          />
        </section>

        {/* Ou part votre argent */}
        <section className="carte">
          <h2 className="titre-carte">Où part votre argent</h2>
          <p className="sous-ligne mt-0.5 mb-4">
            Sur {formatHTG(c.repartition?.total ?? 0)} encaissés · {c.libellePeriode.toLowerCase()}
          </p>

          {!c.repartition ? (
            <EtatVide
              icone={PieChart}
              titre="Pas encore de données"
              texte="Clôturez une journée et saisissez une dépense pour voir la répartition."
            />
          ) : c.repartition.deficitaire ? (
            <EtatVide
              icone={PieChart}
              titre="Vous avez dépensé plus que vous n'avez encaissé"
              texte={`${formatHTG(c.repartition.depense)} de dépenses pour ${formatHTG(c.repartition.total)} de recettes. C'est courant le mois d'un gros réapprovisionnement : le stock acheté se vendra les semaines suivantes.`}
            />
          ) : (
            <DonutCategories parts={c.donut} total={c.repartition.total} />
          )}
        </section>

        {/* Revenus vs depenses */}
        <CarteHero
          variante="bleue"
          titre="Revenus et dépenses"
          chiffre={formatHTG(c.revenus)}
          sousLigne={`dont ${formatHTG(c.depenses)} de dépenses`}
        >
          <BarreSplit
            surSombre
            gauche={{ libelle: 'Bénéfice', valeur: Math.max(0, c.benefice) }}
            droite={{ libelle: 'Dépenses', valeur: c.depenses }}
          />
        </CarteHero>

        {/* Prix d'approvisionnement */}
        <section className="carte">
          <header className="mb-3">
            <h2 className="titre-carte">Prix d'approvisionnement</h2>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="chiffre-hero">
                {c.dernierCout != null ? formatPrix(c.dernierCout) : '—'}
              </span>
              {c.variation && (
                <span className="text-xs" style={{ color: 'var(--texte-doux)' }}>
                  {c.variation.sens === 'hausse' ? '↗' : c.variation.sens === 'baisse' ? '↘' : '→'}{' '}
                  depuis {formatPrix(c.variation.avant)}
                </span>
              )}
            </div>
            <p className="sous-ligne mt-0.5">par gallon, chez la compagnie</p>
          </header>

          {c.historique.length ? (
            <GraphePrixAppro historique={c.historique} />
          ) : (
            <EtatVide
              icone={Truck}
              titre="Aucun réapprovisionnement"
              texte="Saisissez un achat de camion pour suivre l'évolution du prix de la compagnie."
            />
          )}
        </section>

        {/* Marge par gallon */}
        <section className="carte">
          <h2 className="titre-carte">Marge par gallon</h2>

          {!c.margeActuelle ? (
            <EtatVide
              icone={TrendingUp}
              titre="Marge inconnue"
              texte="Saisissez un réapprovisionnement pour connaître votre coût de revient et votre marge réelle."
            />
          ) : (
            <>
              <p className="chiffre-hero mt-1.5">{formatPrix(c.margeActuelle.marge)}</p>
              <p className="sous-ligne mt-0.5">
                Vente {formatPrix(c.margeActuelle.prix)} · Dernier coût{' '}
                {formatPrix(c.margeActuelle.cout)}
              </p>

              <BarreSplit
                className="mt-4"
                gauche={{
                  libelle: 'Coût',
                  valeur: c.margeActuelle.cout,
                  couleur: 'var(--surface-doux)',
                }}
                droite={{
                  libelle: 'Marge',
                  valeur: c.margeActuelle.marge,
                  couleur: 'var(--action)',
                }}
              />

              {c.margeMois && (
                <p className="sous-ligne mt-4">
                  Marge réellement réalisée ce mois :{' '}
                  <strong style={{ color: 'var(--texte)' }}>
                    {formatPrix(c.margeMois.marge)}
                  </strong>{' '}
                  par gallon, au coût moyen pondéré de {formatPrix(c.margeMois.cout)}.
                </p>
              )}
            </>
          )}
        </section>

        {/* Rendement de chaque camion */}
        <section className="carte lg:col-span-2">
          <h2 className="titre-carte">Rendement par approvisionnement</h2>
          <p className="sous-ligne mt-0.5 mb-4">
            Ce que chaque camion vous a rapporté, du plus récent au plus ancien.
          </p>
          <SuiviLots suivi={c.suivi} />
        </section>

        {/* Stock et paiements */}
        <div className="colonne grid gap-3">
          <CarteStat
            titre="Gallons en stock"
            icone={Warehouse}
            chiffre={Math.round(c.stock).toLocaleString('fr-FR')}
            sousLigne={
              c.jours != null
                ? `~${Math.round(c.jours)} jours au rythme actuel`
                : 'autonomie inconnue'
            }
          />

          <section className="carte">
            <h2 className="titre-carte">Modes de paiement</h2>
            <p className="sous-ligne mt-0.5 mb-4">Répartition de vos encaissements</p>
            {c.paiement ? (
              <BarreSplit
                gauche={{
                  libelle: `Cash · ${formatHTG(c.paiement.cash)}`,
                  valeur: c.paiement.cash,
                  couleur: 'var(--surface-doux)',
                }}
                droite={{
                  libelle: `MonCash · ${formatHTG(c.paiement.moncash)}`,
                  valeur: c.paiement.moncash,
                  couleur: 'var(--accent)',
                }}
              />
            ) : (
              <EtatVide titre="Aucun encaissement ce mois" />
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function calculer(etat, fenetre, periodeGlobale) {
  // `mois` porte la periode consultee (bouton d'en-tete) ; `fenetre` ne pilote
  // que la largeur de la courbe des revenus, qui a sa propre echelle de temps.
  const mois = periodeGlobale.intervalle
  // A durees egales : comparer un mois entame a un mois precedent complet
  // afficherait une baisse systematique en debut de mois.
  const precedent = periodeGlobale.cle === 'mois' ? M.moisPrecedentAuMemeJour() : null

  const serie =
    fenetre === '12m'
      ? M.serieMensuelle(etat, 12)
      : M.serieQuotidienne(etat, M.derniersJours(fenetre === '7j' ? 7 : 30), {
          rognerFin: true,
        })

  const repartition = M.ouPartArgent(etat, mois)

  // Les depenses d'abord, le benefice en dernier : l'oeil lit le donut dans
  // le sens horaire depuis midi, et ce qui reste doit venir en conclusion.
  const donut = repartition
    ? [
        ...repartition.parts.map((p) => ({ nom: p.nom, montant: p.montant, couleur: p.couleur })),
        // Le cyan de la planche : c'est la seule des quatre couleurs qui tienne
        // sur fond clair comme sur fond sombre, donc DonutCategories la laisse
        // telle quelle lors de la transposition.
        { nom: 'Bénéfice', montant: Math.max(0, repartition.benefice), couleur: '#22D3F5' },
      ].filter((p) => p.montant > 0)
    : []

  return {
    revenus: M.totalRevenus(etat, mois),
    depenses: M.totalDepenses(etat, mois),
    benefice: M.beneficeNet(etat, mois),
    beneficePrecedent: precedent ? M.beneficeNet(etat, precedent) : null,
    deltaBenefice: precedent
      ? M.variationPct(M.beneficeNet(etat, mois), M.beneficeNet(etat, precedent))
      : null,
    libellePeriode: periodeGlobale.libelle,
    serie,
    semaine: M.serieSemaine(etat, M.derniersJours(28)),
    jourActuel: (new Date().getDay() + 6) % 7,
    repartition,
    donut,
    historique: M.historiquePrixAppro(etat, M.TOUT),
    suivi: M.suiviApprovisionnements(etat),
    prevision: M.previsionMois(etat),
    rupture: M.previsionRupture(etat),
    seriePrevision: M.seriePrevision(etat),
    dernierCout: M.dernierCoutGallon(etat),
    variation: M.variationDernierPrix(etat),
    margeActuelle: M.margeActuelle(etat),
    margeMois: M.margePeriode(etat, mois),
    stock: M.gallonsEnStock(etat),
    jours: M.joursDeStock(etat),
    paiement: M.splitPaiement(etat, mois),
  }
}
