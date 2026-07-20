import { useCallback, useEffect, useState } from 'react'
import { Delete, Fingerprint, Droplet } from 'lucide-react'
import { verifierCode, demanderBiometrie } from '../lib/verrou.js'
import { useStore } from '../store/useStore.js'

/**
 * Ecran de deverrouillage.
 *
 * Pave numerique a grosses cibles : on le compose debout, souvent d'une seule
 * main, parfois en plein soleil. Aucun champ de texte — un clavier systeme
 * mettrait une seconde a s'ouvrir et masquerait la moitie de l'ecran.
 *
 * La biometrie est proposee en premier quand elle est disponible, et se
 * declenche d'elle-meme a l'ouverture : dans le cas courant, l'utilisateur
 * pose son doigt sans rien avoir a toucher.
 */
const LONGUEUR = 4

export default function EcranVerrou() {
  const reglages = useStore((s) => s.reglages)
  const deverrouiller = useStore((s) => s.deverrouiller)

  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState(false)
  const [biometrieEnCours, setBiometrieEnCours] = useState(false)

  const avecBiometrie = !!reglages.verrou_biometrie

  const lancerBiometrie = useCallback(async () => {
    if (!avecBiometrie || biometrieEnCours) return
    setBiometrieEnCours(true)
    const ok = await demanderBiometrie(reglages.verrou_biometrie)
    setBiometrieEnCours(false)
    if (ok) deverrouiller()
  }, [avecBiometrie, biometrieEnCours, reglages.verrou_biometrie, deverrouiller])

  // Proposee d'emblee : le geste attendu est de poser le doigt, pas de
  // chercher un bouton.
  useEffect(() => {
    lancerBiometrie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const valider = useCallback(
    async (code) => {
      const ok = await verifierCode(code, reglages.verrou_sel, reglages.verrou_empreinte)
      if (ok) return deverrouiller()
      setErreur(true)
      // Laisse le temps de voir les quatre points remplis avant d'effacer :
      // vider instantanement donne l'impression d'une frappe non prise en
      // compte plutot que d'un code faux.
      setTimeout(() => {
        setSaisie('')
        setErreur(false)
      }, 550)
    },
    [reglages.verrou_sel, reglages.verrou_empreinte, deverrouiller],
  )

  function taper(chiffre) {
    if (erreur || saisie.length >= LONGUEUR) return
    const suite = saisie + chiffre
    setSaisie(suite)
    if (suite.length === LONGUEUR) valider(suite)
  }

  // Le clavier physique doit marcher aussi : sur ordinateur, taper quatre
  // chiffres est plus rapide que de viser des boutons a la souris.
  useEffect(() => {
    const auClavier = (e) => {
      if (/^\d$/.test(e.key)) taper(e.key)
      else if (e.key === 'Backspace') setSaisie((s) => s.slice(0, -1))
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  })

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-10"
      style={{ background: 'var(--fond)' }}
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <span
          className="grid size-14 place-items-center rounded-[16px]"
          style={{ background: 'var(--accent)', color: 'var(--sur-accent)' }}
        >
          <Droplet size={26} strokeWidth={2} fill="currentColor" />
        </span>

        <h1 className="mt-5 text-lg font-medium">Application verrouillée</h1>
        <p className="sous-ligne mt-1">
          {avecBiometrie ? 'Empreinte ou code à 4 chiffres' : 'Saisissez votre code à 4 chiffres'}
        </p>

        <div className={`mt-7 flex gap-3.5 ${erreur ? 'animate-[secousse_.4s]' : ''}`}>
          {Array.from({ length: LONGUEUR }, (_, i) => (
            <span
              key={i}
              className="size-3.5 rounded-full transition-colors"
              style={{
                background:
                  i < saisie.length
                    ? erreur
                      ? 'var(--vert)'
                      : 'var(--action)'
                    : 'var(--gris-data)',
              }}
            />
          ))}
        </div>

        <p
          className="mt-3 h-4 text-xs"
          style={{ color: 'var(--texte-doux)', visibility: erreur ? 'visible' : 'hidden' }}
        >
          Code incorrect
        </p>
      </div>

      <div className="w-full max-w-[300px]">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Touche key={n} onClick={() => taper(String(n))}>
              {n}
            </Touche>
          ))}

          {avecBiometrie ? (
            <Touche onClick={lancerBiometrie} discret aria-label="Déverrouiller par empreinte">
              <Fingerprint
                size={24}
                strokeWidth={1.75}
                className={biometrieEnCours ? 'animate-pulse' : ''}
              />
            </Touche>
          ) : (
            <span />
          )}

          <Touche onClick={() => taper('0')}>0</Touche>

          <Touche
            onClick={() => setSaisie((s) => s.slice(0, -1))}
            discret
            aria-label="Effacer un chiffre"
          >
            <Delete size={22} strokeWidth={1.75} />
          </Touche>
        </div>
      </div>
    </div>
  )
}

function Touche({ children, onClick, discret = false, ...props }) {
  return (
    <button
      onClick={onClick}
      className="grid h-16 place-items-center rounded-[18px] text-xl transition-transform active:scale-95"
      style={{
        background: discret ? 'transparent' : 'var(--surface)',
        color: discret ? 'var(--texte-doux)' : 'var(--texte)',
        fontVariantNumeric: 'tabular-nums',
      }}
      {...props}
    >
      {children}
    </button>
  )
}
