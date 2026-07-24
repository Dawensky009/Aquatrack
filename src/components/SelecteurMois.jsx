import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Feuille from './Feuille.jsx'

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const idxDe = (annee, mois) => annee * 12 + mois
const depuisIdx = (i) => ({ annee: Math.floor(i / 12), mois: ((i % 12) + 12) % 12 })
const memeMois = (a, b) => a.annee === b.annee && a.mois === b.mois

/** Étiquette d'une plage : un seul mois, ou « Juil – Sep 2026 ». */
function libellePlage(debut, fin) {
  if (memeMois(debut, fin)) return `${MOIS[debut.mois]} ${debut.annee}`
  const memeAnnee = debut.annee === fin.annee
  const gauche = memeAnnee ? MOIS_COURTS[debut.mois] : `${MOIS_COURTS[debut.mois]} ${debut.annee}`
  return `${gauche} – ${MOIS_COURTS[fin.mois]} ${fin.annee}`
}

/**
 * Navigation de periode : un mois, ou une PLAGE de mois.
 *
 * Les fleches couvrent le cas courant — reculer d'un mois — en decalant toute
 * la fenetre d'un cran, ce qui preserve la largeur de la plage choisie. Le
 * libelle central ouvre une selection complete ou l'on peut, d'un mois puis
 * d'un autre, delimiter une plage.
 */
export default function SelecteurMois({ debut, fin, onChange, anneesDisponibles }) {
  const [ouvert, setOuvert] = useState(false)

  const decaler = (n) => {
    onChange(depuisIdx(idxDe(debut.annee, debut.mois) + n), depuisIdx(idxDe(fin.annee, fin.mois) + n))
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Fleche onClick={() => decaler(-1)} label="Période précédente">
          <ChevronLeft size={17} strokeWidth={2} />
        </Fleche>

        <button
          onClick={() => setOuvert(true)}
          className="cible-tactile flex-1 truncate rounded-full px-3 py-1.5 text-[13px] font-medium capitalize"
          style={{ background: 'var(--surface-doux)' }}
        >
          {libellePlage(debut, fin)}
        </button>

        <Fleche onClick={() => decaler(1)} label="Période suivante">
          <ChevronRight size={17} strokeWidth={2} />
        </Fleche>
      </div>

      {ouvert && (
        <FeuilleChoix
          debut={debut}
          fin={fin}
          annees={anneesDisponibles}
          onChoisir={(d, f) => {
            onChange(d, f)
            setOuvert(false)
          }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  )
}

function Fleche({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full"
      style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
    >
      {children}
    </button>
  )
}

/**
 * Choix d'une periode : touchez un mois, puis un autre pour une plage.
 *
 * On travaille en index absolus (annee × 12 + mois) : une plage peut ainsi
 * enjamber le changement d'annee sans cas particulier. Rien ne s'applique
 * avant « Appliquer » — la selection a deux temps se verrait sinon confirmee
 * a mi-chemin.
 */
function FeuilleChoix({ debut, fin, annees, onChoisir, onFermer }) {
  const [anneeVue, setAnneeVue] = useState(fin.annee)
  const [selDebut, setSelDebut] = useState(idxDe(debut.annee, debut.mois))
  const [selFin, setSelFin] = useState(idxDe(fin.annee, fin.mois))
  // `enCours` : la premiere touche d'une nouvelle plage attend la seconde.
  const [enCours, setEnCours] = useState(false)

  const liste = useMemo(() => {
    const s = new Set([...(annees ?? []), new Date().getFullYear(), debut.annee, fin.annee])
    return [...s].sort((a, b) => b - a)
  }, [annees, debut.annee, fin.annee])

  const bas = Math.min(selDebut, selFin)
  const haut = Math.max(selDebut, selFin)

  const toucher = (m) => {
    if (!enCours) {
      // Premiere touche : on repart d'un point unique.
      setSelDebut(m)
      setSelFin(m)
      setEnCours(true)
    } else {
      // Seconde touche : l'autre borne. L'ordre est remis d'aplomb.
      setSelFin(m)
      setEnCours(false)
    }
  }

  const dDebut = depuisIdx(bas)
  const dFin = depuisIdx(haut)

  return (
    <Feuille titre="Choisir une période" onFermer={onFermer}>
      <div className="pb-4">
        <p className="sous-ligne mb-3">
          Touchez un mois — puis un autre pour une plage.
        </p>

        <div className="defile-x mb-4 flex gap-2">
          {liste.map((a) => (
            <button
              key={a}
              onClick={() => setAnneeVue(a)}
              className="chiffres shrink-0 rounded-full px-4 py-2 text-[13px]"
              style={{
                background: a === anneeVue ? 'var(--action)' : 'var(--surface-doux)',
                color: a === anneeVue ? 'var(--sur-action)' : 'var(--texte-doux)',
                fontWeight: a === anneeVue ? 500 : 400,
              }}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MOIS_COURTS.map((m, i) => {
            const idx = idxDe(anneeVue, i)
            const borne = idx === bas || idx === haut
            const dans = idx > bas && idx < haut
            return (
              <button
                key={m}
                onClick={() => toucher(idx)}
                className="flex items-center justify-center rounded-[14px] py-3 text-[13px] transition-colors"
                style={{
                  background: borne ? 'var(--action)' : 'var(--surface-doux)',
                  // Les mois INTERIEURS a la plage gardent le fond doux mais
                  // portent un liseré et le ton d'action : la plage se lit d'un
                  // bloc, sans dependre d'une couleur intermediaire a definir.
                  color: borne ? 'var(--sur-action)' : dans ? 'var(--action)' : 'var(--texte)',
                  fontWeight: borne || dans ? 500 : 400,
                  outline: dans ? '1.5px solid var(--action)' : 'none',
                  outlineOffset: dans ? '-1.5px' : '0',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium capitalize">
            {libellePlage(dDebut, dFin)}
          </span>
          <button
            onClick={() => onChoisir(dDebut, dFin)}
            className="rounded-full px-5 py-2.5 text-[13px] font-medium transition-transform active:scale-[0.98]"
            style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </Feuille>
  )
}

export { MOIS }
