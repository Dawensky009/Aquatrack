import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { lireMeta, ecrireMeta } from '../lib/db.js'

/**
 * Invite a installer l'application sur l'ecran d'accueil.
 *
 * Deux chemins, parce que les navigateurs ne se valent pas :
 *
 *   - Android / Chrome : l'evenement `beforeinstallprompt` permet de
 *     declencher l'installation native depuis un bouton.
 *   - iOS / Safari : cet evenement N'EXISTE PAS. Il n'y a aucun moyen de
 *     provoquer l'installation par programme ; la seule option est
 *     d'expliquer le geste (Partager -> Sur l'ecran d'accueil).
 *
 * L'invite est rejetable et le choix memorise : proposer deux fois une chose
 * refusee est une nuisance.
 */
export default function InviteInstallation() {
  const [evenement, setEvenement] = useState(null)
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const dejaInstallee =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (dejaInstallee) return

    const estIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const estSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    setIos(estIos && estSafari)

    lireMeta('invite_installation_rejetee', false).then((rejetee) => {
      if (rejetee) return
      if (estIos && estSafari) setVisible(true)
    })

    const surInvite = (e) => {
      e.preventDefault()
      setEvenement(e)
      lireMeta('invite_installation_rejetee', false).then((rejetee) => {
        if (!rejetee) setVisible(true)
      })
    }
    window.addEventListener('beforeinstallprompt', surInvite)
    return () => window.removeEventListener('beforeinstallprompt', surInvite)
  }, [])

  if (!visible) return null

  async function installer() {
    if (!evenement) return
    evenement.prompt()
    await evenement.userChoice
    setVisible(false)
  }

  async function rejeter() {
    await ecrireMeta('invite_installation_rejetee', true)
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-x-0 z-40 mx-auto w-full max-w-[480px] px-4 lg:right-6 lg:left-auto lg:mx-0 lg:max-w-[360px]"
      style={{ bottom: 'calc(var(--hauteur-nav) + 16px)' }}
    >
      <div
        className="flex items-center gap-3 rounded-[16px] p-3.5"
        style={{
          background: 'var(--action)',
          color: 'var(--sur-action)',
          boxShadow: 'var(--ombre-flottant)',
        }}
      >
        <span className="shrink-0 opacity-70">
          {ios ? <Share size={18} /> : <Download size={18} />}
        </span>

        <p className="min-w-0 flex-1 text-xs leading-snug">
          {ios ? (
            <>
              Installez Aqua Track : appuyez sur <strong>Partager</strong>, puis{' '}
              <strong>Sur l'écran d'accueil</strong>.
            </>
          ) : (
            <>Installez Aqua Track pour l'ouvrir en plein écran, même sans connexion.</>
          )}
        </p>

        {!ios && (
          <button
            onClick={installer}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: 'var(--accent)', color: 'var(--sur-accent)' }}
          >
            Installer
          </button>
        )}

        <button onClick={rejeter} aria-label="Ne plus proposer" className="shrink-0 opacity-60">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
