import { Check } from 'lucide-react'
import Feuille from './Feuille.jsx'
import { useStore } from '../store/useStore.js'
import * as M from '../lib/metrics.js'

/**
 * Choix de la periode consultee.
 *
 * Le bouton « Ce mois » de la maquette n'etait qu'un decor : il ouvre
 * desormais ce selecteur. Quatre choix suffisent — au-dela, on ajouterait un
 * selecteur de dates personnalisees pour un besoin qui, sur un kiosque, ne se
 * presente pas.
 */
export const PERIODES = {
  mois: { libelle: 'Ce mois', calc: () => M.moisCourant() },
  precedent: { libelle: 'Mois dernier', calc: () => M.moisPrecedent() },
  '30j': { libelle: '30 derniers jours', calc: () => M.derniersJours(30) },
  tout: { libelle: 'Depuis le début', calc: () => M.TOUT },
}

/** Resout la cle de periode en intervalle, plus son libelle d'affichage. */
export function usePeriode() {
  const cle = useStore((s) => s.periode)
  const def = PERIODES[cle] ?? PERIODES.mois
  return { cle, libelle: def.libelle, intervalle: def.calc() }
}

export default function FeuillePeriode() {
  const periode = useStore((s) => s.periode)
  const choisirPeriode = useStore((s) => s.choisirPeriode)
  const fermerFeuille = useStore((s) => s.fermerFeuille)

  return (
    <Feuille titre="Période" onFermer={fermerFeuille}>
      <ul className="flex flex-col gap-1 pb-4">
        {Object.entries(PERIODES).map(([cle, { libelle }]) => {
          const actif = cle === periode
          return (
            <li key={cle}>
              <button
                onClick={() => {
                  choisirPeriode(cle)
                  fermerFeuille()
                }}
                className="flex w-full items-center justify-between rounded-[14px] px-4 py-3.5 text-left text-sm transition-transform active:scale-[0.99]"
                style={{
                  background: actif ? 'var(--action)' : 'var(--surface-doux)',
                  color: actif ? 'var(--sur-action)' : 'var(--texte)',
                  fontWeight: actif ? 500 : 400,
                }}
              >
                {libelle}
                {actif && <Check size={17} strokeWidth={2.25} />}
              </button>
            </li>
          )
        })}
      </ul>
    </Feuille>
  )
}
