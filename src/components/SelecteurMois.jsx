import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import Feuille from './Feuille.jsx'

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

/**
 * Navigation de mois en mois, avec acces direct par annee.
 *
 * Les fleches couvrent le cas courant — consulter le mois precedent — et le
 * libelle central ouvre une selection complete pour remonter loin sans dizaines
 * de taps.
 */
export default function SelecteurMois({ annee, mois, onChange, anneesDisponibles }) {
  const [ouvert, setOuvert] = useState(false)

  const decaler = (n) => {
    const d = new Date(annee, mois + n, 1)
    onChange(d.getFullYear(), d.getMonth())
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Fleche onClick={() => decaler(-1)} label="Mois précédent">
          <ChevronLeft size={17} strokeWidth={2} />
        </Fleche>

        <button
          onClick={() => setOuvert(true)}
          className="cible-tactile flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium capitalize"
          style={{ background: 'var(--surface-doux)' }}
        >
          {MOIS[mois]} {annee}
        </button>

        <Fleche onClick={() => decaler(1)} label="Mois suivant">
          <ChevronRight size={17} strokeWidth={2} />
        </Fleche>
      </div>

      {ouvert && (
        <FeuilleChoix
          annee={annee}
          mois={mois}
          annees={anneesDisponibles}
          onChoisir={(a, m) => {
            onChange(a, m)
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

function FeuilleChoix({ annee, mois, annees, onChoisir, onFermer }) {
  const [anneeVue, setAnneeVue] = useState(annee)

  // Toujours proposer l'annee en cours, meme sans donnee : on peut vouloir
  // consulter un mois a venir, ou saisir un rattrapage.
  const liste = useMemo(() => {
    const s = new Set([...(annees ?? []), new Date().getFullYear(), annee])
    return [...s].sort((a, b) => b - a)
  }, [annees, annee])

  return (
    <Feuille titre="Choisir une période" onFermer={onFermer}>
      <div className="pb-4">
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
            const actif = i === mois && anneeVue === annee
            return (
              <button
                key={m}
                onClick={() => onChoisir(anneeVue, i)}
                className="flex items-center justify-center gap-1.5 rounded-[14px] py-3 text-[13px]"
                style={{
                  background: actif ? 'var(--action)' : 'var(--surface-doux)',
                  color: actif ? 'var(--sur-action)' : 'var(--texte)',
                  fontWeight: actif ? 500 : 400,
                }}
              >
                {m}
                {actif && <Check size={14} strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>
      </div>
    </Feuille>
  )
}

export { MOIS }
