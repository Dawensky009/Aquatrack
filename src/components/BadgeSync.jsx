import { Cloud, CloudOff, RefreshCw, Check, HardDrive } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * Etat de la synchronisation, en pilule discrete.
 *
 * L'utilisateur doit pouvoir saisir une recette sans jamais se demander si
 * elle est perdue. Le badge repond a cette question en permanence — y
 * compris quand il n'y a pas de serveur du tout (« Local »), ce qui est un
 * etat parfaitement valide et non une erreur.
 */
const ETATS = {
  local: { icone: HardDrive, texte: 'Local', aide: 'Données enregistrées sur cet appareil' },
  'non-connecte': {
    icone: CloudOff,
    texte: 'Hors sauvegarde',
    aide: 'Connectez-vous dans Réglages pour sauvegarder en ligne',
  },
  'sans-kiosque': {
    icone: CloudOff,
    texte: 'Kiosque à définir',
    aide: 'Créez ou rejoignez un kiosque dans Réglages',
  },
  'hors-ligne': { icone: CloudOff, texte: 'Hors-ligne', aide: 'Vos saisies partiront au retour du réseau' },
  'en-cours': { icone: RefreshCw, texte: 'Synchro…', aide: 'Envoi en cours' },
  'en-attente': { icone: Cloud, texte: null, aide: 'En attente d’envoi' },
  'a-jour': { icone: Check, texte: 'À jour', aide: 'Tout est sauvegardé' },
}

export default function BadgeSync() {
  const sync = useStore((s) => s.sync)
  const etat = ETATS[sync.statut] ?? ETATS.local
  const Icone = etat.icone
  const texte = etat.texte ?? `${sync.enAttente} en attente`

  return (
    <span
      title={etat.aide}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
      style={{ background: 'var(--surface)', color: 'var(--texte-doux)' }}
    >
      <Icone
        size={12}
        strokeWidth={2}
        className={sync.statut === 'en-cours' ? 'animate-spin' : ''}
      />
      {texte}
    </span>
  )
}
