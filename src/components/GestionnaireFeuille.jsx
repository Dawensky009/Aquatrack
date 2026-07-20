import { CalendarCheck, Truck, ChevronRight } from 'lucide-react'
import Feuille from './Feuille.jsx'
import FeuilleCloture from './FeuilleCloture.jsx'
import FeuilleDepense from './FeuilleDepense.jsx'
import FeuillePeriode from './FeuillePeriode.jsx'
import FeuilleLot from './FeuilleLot.jsx'
import FeuilleExport from './FeuilleExport.jsx'
import { useStore } from '../store/useStore.js'

/**
 * Aiguillage des feuilles de saisie.
 *
 * Le bouton « + » ne peut pas deviner l'intention : il propose donc les deux
 * seules actions de l'application. Un ecran de choix a deux entrees, plutot
 * qu'un formulaire unique surcharge de champs conditionnels.
 */
export default function GestionnaireFeuille() {
  const feuille = useStore((s) => s.feuille)
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)
  const fermerFeuille = useStore((s) => s.fermerFeuille)

  if (!feuille) return null

  if (feuille.type === 'cloture') {
    return <FeuilleCloture dateInitiale={feuille.donnees?.date} />
  }

  if (feuille.type === 'depense') {
    return <FeuilleDepense depense={feuille.donnees} />
  }

  if (feuille.type === 'periode') {
    return <FeuillePeriode />
  }

  if (feuille.type === 'lot') {
    return <FeuilleLot lotId={feuille.donnees?.id} />
  }

  if (feuille.type === 'export') {
    return <FeuilleExport />
  }

  return (
    <Feuille titre="Que voulez-vous enregistrer ?" onFermer={fermerFeuille}>
      <div className="flex flex-col gap-2 pb-4">
        <Choix
          icone={CalendarCheck}
          titre="Clôturer la journée"
          texte="Saisir la recette du jour"
          onClick={() => ouvrirFeuille('cloture')}
        />
        <Choix
          icone={Truck}
          titre="Ajouter une dépense"
          texte="Réapprovisionnement, matériel…"
          onClick={() => ouvrirFeuille('depense')}
        />
      </div>
    </Feuille>
  )
}

function Choix({ icone: Icone, titre, texte, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-[16px] p-3.5 text-left transition-transform active:scale-[0.99]"
      style={{ background: 'var(--surface-doux)' }}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-[12px]"
        style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
      >
        <Icone size={20} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titre}</span>
        <span className="sous-ligne block">{texte}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--texte-tres-doux)' }} />
    </button>
  )
}
