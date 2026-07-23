import { useState } from 'react'
import { Database, FileSpreadsheet, ChevronRight, Loader2 } from 'lucide-react'
import Feuille from './Feuille.jsx'
import Pastille from './Pastille.jsx'
import { useStore } from '../store/useStore.js'
import { exporterSauvegarde, exporterExcel } from '../lib/echange.js'

/**
 * Choix du format d'export.
 *
 * L'ordre et la formulation portent une intention : la sauvegarde JSON vient
 * en premier et est la seule presentee comme telle. Les CSV sont utiles mais
 * ne protegent pas les donnees — ils ne transportent pas les photos de recus.
 * Quelqu'un qui exporte « pour ne rien perdre » doit repartir avec le JSON.
 */
export default function FeuilleExport() {
  const fermerFeuille = useStore((s) => s.fermerFeuille)
  const [occupe, setOccupe] = useState(null)
  const [fait, setFait] = useState(null)

  async function lancer(cle, action, message) {
    setOccupe(cle)
    try {
      const r = await action()
      setFait(message(r))
    } finally {
      setOccupe(null)
    }
  }

  return (
    <Feuille titre="Exporter" onFermer={fermerFeuille}>
      <div className="flex flex-col gap-2 pb-4">
        <Choix
          icone={Database}
          titre="Sauvegarde complète"
          texte="Fichier JSON — tout est dedans, photos de reçus comprises. C'est le format à garder pour ne rien perdre."
          occupe={occupe === 'json'}
          onClick={() =>
            lancer('json', exporterSauvegarde, (r) =>
              r.recus > 0
                ? `Sauvegarde téléchargée, ${r.recus} reçu${r.recus > 1 ? 's' : ''} inclus.`
                : 'Sauvegarde téléchargée.',
            )
          }
        />

        <Choix
          icone={FileSpreadsheet}
          titre="Feuille de calcul Excel"
          texte="Un classeur .xlsx avec deux feuilles — Recettes et Dépenses. Dates et montants correctement formatés, prêts à imprimer ou à donner au comptable."
          occupe={occupe === 'excel'}
          onClick={() =>
            lancer(
              'excel',
              exporterExcel,
              (r) => `Classeur téléchargé : ${r.recettes} journées, ${r.depenses} dépenses.`,
            )
          }
        />

        {fait && <Pastille bloc>{fait}</Pastille>}

        <p className="sous-ligne mt-2">
          Le fichier Excel ne contient pas les photos de reçus — un tableur ne sait pas
          transporter d'images. Pour une sauvegarde qui restaure tout, choisissez le format
          JSON.
        </p>
      </div>
    </Feuille>
  )
}

function Choix({ icone: Icone, titre, texte, onClick, occupe }) {
  return (
    <button
      onClick={onClick}
      disabled={occupe}
      className="flex items-center gap-3.5 rounded-[16px] p-3.5 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
      style={{ background: 'var(--surface-doux)' }}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-[12px]"
        style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
      >
        {occupe ? (
          <Loader2 size={20} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <Icone size={20} strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titre}</span>
        <span className="sous-ligne block">{texte}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--texte-tres-doux)' }} />
    </button>
  )
}
