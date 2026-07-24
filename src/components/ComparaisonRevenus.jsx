import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SegmentPills from './SegmentPills.jsx'
import Delta from './Delta.jsx'
import { formatHTG } from '../lib/format.js'
import * as M from '../lib/metrics.js'

/**
 * Comparaison des revenus entre deux periodes CHOISIES.
 *
 * On ne compare plus seulement « ce mois vs le mois dernier » : chaque cote a
 * son propre selecteur, pour confronter deux mois — ou deux annees — au choix.
 *
 * Le parti pris qui rend la comparaison honnete tient toujours : « À MÊME
 * DATE ». Des qu'un des deux cotes est la periode EN COURS — forcement
 * partielle —, on arrete l'autre au meme quantieme (voir `comparerMois`).
 * Deux periodes passees completes, elles, se comparent en entier.
 */
const MODES = [
  { valeur: 'mois', libelle: 'Mois' },
  { valeur: 'annee', libelle: 'Année' },
]

const MOIS_AB = [
  'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.',
]
const MOIS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const idxMois = (annee, mois) => annee * 12 + mois
const depuisIdx = (i) => ({ annee: Math.floor(i / 12), mois: ((i % 12) + 12) % 12 })

export default function ComparaisonRevenus({ etat }) {
  const [mode, setMode] = useState('mois')
  const maintenant = new Date()

  // Bornes : on ne remonte pas avant la premiere donnee, et on ne descend
  // jamais dans le futur — comparer avec un mois pas encore commence n'a
  // aucun sens.
  const anneeMin = useMemo(() => {
    let min = maintenant.getFullYear()
    for (const j of etat.journees) {
      const y = Number(j.date.slice(0, 4))
      if (Number.isFinite(y) && y < min) min = y
    }
    return min
  }, [etat.journees, maintenant])

  const idxMax = idxMois(maintenant.getFullYear(), maintenant.getMonth())
  const idxMin = idxMois(anneeMin, 0)
  const anneeMax = maintenant.getFullYear()

  const [aMois, setAMois] = useState({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })
  const [bMois, setBMois] = useState(depuisIdx(idxMax - 1))
  const [aAnnee, setAAnnee] = useState(maintenant.getFullYear())
  const [bAnnee, setBAnnee] = useState(maintenant.getFullYear() - 1)

  const decalerMois = (set, actuel, pas) => {
    const cible = Math.min(idxMax, Math.max(idxMin, idxMois(actuel.annee, actuel.mois) + pas))
    set(depuisIdx(cible))
  }
  const decalerAnnee = (set, actuel, pas) =>
    set(Math.min(anneeMax, Math.max(anneeMin, actuel + pas)))

  const enMois = mode === 'mois'
  const res = enMois
    ? M.comparerMois(etat, aMois, bMois)
    : M.comparerAnnees(etat, aAnnee, bAnnee)

  const delta = M.variationPct(res.a, res.b)
  const max = Math.max(res.a, res.b, 1)

  const libelleB = enMois ? `${MOIS_LONG[bMois.mois]} ${bMois.annee}` : String(bAnnee)

  return (
    <section className="carte">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="titre-carte">Comparaison</h2>
          <p className="sous-ligne mt-0.5">
            Revenus · {res.tronque ? 'à même date' : 'périodes complètes'}
          </p>
        </div>
        <SegmentPills
          taille="compacte"
          options={MODES}
          valeur={mode}
          onChange={setMode}
          className="w-auto"
        />
      </header>

      <div className="flex flex-col gap-3.5">
        <Ligne
          montant={res.a}
          max={max}
          couleur="var(--action)"
          selecteur={
            enMois ? (
              <Stepper
                label={`${MOIS_AB[aMois.mois]} ${aMois.annee}`}
                onMoins={() => decalerMois(setAMois, aMois, -1)}
                onPlus={() => decalerMois(setAMois, aMois, 1)}
                debutAtteint={idxMois(aMois.annee, aMois.mois) <= idxMin}
                finAtteinte={idxMois(aMois.annee, aMois.mois) >= idxMax}
              />
            ) : (
              <Stepper
                label={String(aAnnee)}
                onMoins={() => decalerAnnee(setAAnnee, aAnnee, -1)}
                onPlus={() => decalerAnnee(setAAnnee, aAnnee, 1)}
                debutAtteint={aAnnee <= anneeMin}
                finAtteinte={aAnnee >= anneeMax}
              />
            )
          }
        />
        <Ligne
          montant={res.b}
          max={max}
          couleur="var(--texte-tres-doux)"
          selecteur={
            enMois ? (
              <Stepper
                label={`${MOIS_AB[bMois.mois]} ${bMois.annee}`}
                onMoins={() => decalerMois(setBMois, bMois, -1)}
                onPlus={() => decalerMois(setBMois, bMois, 1)}
                debutAtteint={idxMois(bMois.annee, bMois.mois) <= idxMin}
                finAtteinte={idxMois(bMois.annee, bMois.mois) >= idxMax}
              />
            ) : (
              <Stepper
                label={String(bAnnee)}
                onMoins={() => decalerAnnee(setBAnnee, bAnnee, -1)}
                onPlus={() => decalerAnnee(setBAnnee, bAnnee, 1)}
                debutAtteint={bAnnee <= anneeMin}
                finAtteinte={bAnnee >= anneeMax}
              />
            )
          }
        />
      </div>

      <p className="sous-ligne mt-4 flex flex-wrap items-center gap-1.5">
        {delta == null ? (
          `Aucun revenu en ${libelleB} pour comparer.`
        ) : (
          <>
            <Delta valeur={delta} />
            {delta >= 0 ? 'de plus' : 'de moins'} qu’en {libelleB}
            {res.tronque ? ', à même date' : ''}.
          </>
        )}
      </p>
    </section>
  )
}

function Ligne({ selecteur, montant, max, couleur }) {
  // Plancher a 2 % : un tout petit revenu doit rester une barre visible, pas
  // un trait qu'on prendrait pour zero.
  const pct = montant > 0 ? Math.max(2, Math.round((montant / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {selecteur}
        <span className="chiffres text-sm font-medium">{formatHTG(montant)}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-doux)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: couleur }}
        />
      </div>
    </div>
  )
}

/** Petit pas-a-pas ‹ étiquette › — flèches grisées aux bornes. */
function Stepper({ label, onMoins, onPlus, debutAtteint, finAtteinte }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      <Fleche onClick={onMoins} desactive={debutAtteint} label="Période précédente">
        <ChevronLeft size={15} strokeWidth={2} />
      </Fleche>
      <span
        className="min-w-[74px] text-center text-[13px] font-medium"
        style={{ color: 'var(--texte)' }}
      >
        {label}
      </span>
      <Fleche onClick={onPlus} desactive={finAtteinte} label="Période suivante">
        <ChevronRight size={15} strokeWidth={2} />
      </Fleche>
    </div>
  )
}

function Fleche({ onClick, desactive, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={desactive}
      aria-label={label}
      className="grid size-7 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-30"
      style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
    >
      {children}
    </button>
  )
}
