import { Cloud, CloudOff, RefreshCw, Check, HardDrive, RotateCw } from 'lucide-react'
import { useStore } from '../store/useStore.js'

/**
 * Etat de la synchronisation, en pilule discrete.
 *
 * L'utilisateur doit pouvoir saisir une recette sans jamais se demander si
 * elle est perdue. Le badge repond a cette question en permanence — y
 * compris quand il n'y a pas de serveur du tout (« Local »), ce qui est un
 * etat parfaitement valide et non une erreur.
 */
// `alerte` : les etats ou vos saisies ne sont PAS sauvegardees en ligne. Le
// badge y prend une teinte rouge douce, pour se remarquer d'un coup d'oeil —
// on veut voir vite qu'on est deconnecte, pas le deviner dans un gris discret.
const ETATS = {
  local: { icone: HardDrive, texte: 'Local', aide: 'Données enregistrées sur cet appareil' },
  'non-connecte': {
    icone: CloudOff,
    texte: 'Déconnecté',
    aide: 'Compte déconnecté — reconnectez-vous dans Réglages pour sauvegarder en ligne',
    alerte: true,
  },
  'sans-kiosque': {
    icone: CloudOff,
    texte: 'Kiosque à définir',
    aide: 'Créez ou rejoignez un kiosque dans Réglages',
    alerte: true,
  },
  // Volontairement bien visible : tant que la démonstration est chargée, rien
  // n'est sauvegardé, et croire le contraire coûterait une journée de recette.
  demo: {
    icone: CloudOff,
    texte: 'Démo',
    aide: 'Données fictives — rien n’est sauvegardé. « Repartir de zéro » dans Réglages.',
    alerte: true,
  },
  'kiosque-different': {
    icone: CloudOff,
    texte: 'Hors sauvegarde',
    aide: 'Ces données appartiennent à un autre kiosque',
    alerte: true,
  },
  'hors-ligne': { icone: CloudOff, texte: 'Hors-ligne', aide: 'Vos saisies partiront au retour du réseau' },
  'en-cours': { icone: RefreshCw, texte: 'Synchro…', aide: 'Envoi en cours' },
  'en-attente': { icone: Cloud, texte: null, aide: 'En attente d’envoi' },
  'a-jour': { icone: Check, texte: 'À jour', aide: 'Tout est sauvegardé' },
}

export default function BadgeSync() {
  const sync = useStore((s) => s.sync)
  const synchroniser = useStore((s) => s.synchroniserMaintenant)

  const etat = ETATS[sync.statut] ?? ETATS.local
  const Icone = etat.icone
  const texte = etat.texte ?? `${sync.enAttente} en attente`
  const enCours = sync.statut === 'en-cours'

  // Forcer la synchro n'a de sens qu'avec un serveur (« local » = aucun) et
  // hors demonstration. Dans ces deux cas, le badge reste un simple indicateur.
  const interactif = sync.statut !== 'local' && sync.statut !== 'demo'

  const contenu = (
    <>
      <Icone size={12} strokeWidth={2} className={enCours ? 'animate-spin' : ''} />
      {texte}
      {/* Petit indice « toucher pour synchroniser » — masque pendant la synchro,
          ou l'icone d'etat tourne deja. */}
      {interactif && !enCours && (
        <RotateCw size={11} strokeWidth={2} style={{ opacity: 0.5 }} className="ml-0.5" />
      )}
    </>
  )

  const classeBase =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]'

  // Teinte : rouge doux pour un etat « pas sauvegarde », neutre sinon.
  const style = etat.alerte
    ? { background: 'var(--rouge-clair)', color: 'var(--rouge)' }
    : { background: 'var(--surface)', color: 'var(--texte-doux)' }

  if (!interactif) {
    return (
      <span title={etat.aide} className={classeBase} style={style}>
        {contenu}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={synchroniser}
      disabled={enCours}
      aria-label="Synchroniser maintenant"
      title={`${etat.aide} · Toucher pour synchroniser`}
      className={`${classeBase} transition-[background-color,transform] active:scale-95 hover:brightness-95 disabled:active:scale-100`}
      style={style}
    >
      {contenu}
    </button>
  )
}
