import { useEffect, useRef, useState } from 'react'
import { Droplet, Loader2, Store, UserPlus, WifiOff } from 'lucide-react'
import Pastille from './Pastille.jsx'
import { useStore } from '../store/useStore.js'
import {
  connecter,
  inscrire,
  creerKiosque,
  rejoindreKiosque,
  monKiosque,
  ErreurAuth,
} from '../lib/auth.js'

/**
 * Ecran d'entree — premiere ouverture de l'appareil.
 *
 * Il bloque l'acces UNE SEULE FOIS, a la premiere installation. Ensuite
 * l'appareil est marque comme configure et l'application s'ouvre directement,
 * sans reseau, indefiniment.
 *
 * C'est le compromis qui compte : exiger la connexion a CHAQUE ouverture
 * rendrait l'application inutilisable un soir de coupure, et la recette du
 * jour serait perdue. Ici, on identifie la personne une fois, puis on ne
 * l'empeche plus jamais de travailler.
 *
 * Deux etapes, parce qu'un compte sans kiosque ouvre une application vide et
 * laisse l'employe sans comprendre pourquoi il ne voit rien.
 */
export default function EcranConnexion() {
  const majSession = useStore((s) => s.majSession)
  const terminerConfiguration = useStore((s) => s.terminerConfiguration)
  const session = useStore((s) => s.session)

  const [etape, setEtape] = useState(session ? 'kiosque' : 'compte')
  const [inscription, setInscription] = useState(false)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState(null)

  // Le test de rattachement ne doit avoir lieu qu'une fois : StrictMode
  // rejoue les effets, et deux appels concurrents se marcheraient dessus.
  const rattachementTeste = useRef(false)

  const [choixKiosque, setChoixKiosque] = useState(null) // null | 'creer' | 'rejoindre'
  const [nomKiosque, setNomKiosque] = useState('')
  const [code, setCode] = useState('')

  const horsReseau = typeof navigator !== 'undefined' && !navigator.onLine

  /**
   * Le compte appartient-il DEJA a un kiosque ?
   *
   * C'est le cas d'un second appareil, d'une reinstallation, ou d'un
   * « Repartir de zero ». Lui reposer la question serait un piege :
   * « Créer mon kiosque » ne creerait rien — le serveur renvoie le kiosque
   * existant — mais l'appareil garderait ses categories amorcees, les
   * enverrait, puis recevrait celles deja en ligne. D'ou des libelles en
   * double dans la liste des depenses.
   *
   * On passe donc l'etape en silence, en abandonnant les categories locales
   * comme le ferait un employe qui rejoint.
   */
  useEffect(() => {
    if (etape !== 'kiosque' || rattachementTeste.current) return
    rattachementTeste.current = true
    let vivant = true
    ;(async () => {
      try {
        if ((await monKiosque()) && vivant) await terminerConfiguration({ rejoint: true })
      } catch {
        // Serveur injoignable : on laisse simplement le choix s'afficher.
      }
    })()
    return () => {
      vivant = false
    }
  }, [etape, terminerConfiguration])

  async function agir(action, suite) {
    setOccupe(true)
    setErreur(null)
    try {
      await action()
      suite?.()
    } catch (e) {
      setErreur(e instanceof ErreurAuth ? e.message : 'Opération impossible.')
    } finally {
      setOccupe(false)
    }
  }

  async function soumettreCompte() {
    if (!email.trim() || motDePasse.length < 6) {
      setErreur('Saisissez un email et un mot de passe d’au moins 6 caractères.')
      return
    }
    await agir(
      async () => {
        if (inscription) {
          const { session: s, confirmationRequise } = await inscrire(email, motDePasse)
          if (confirmationRequise) {
            throw new ErreurAuth('Compte créé. Confirmez votre email, puis connectez-vous.')
          }
          majSession(s)
        } else {
          majSession(await connecter(email, motDePasse))
        }
      },
      () => setEtape('kiosque'),
    )
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center overflow-y-auto px-6 py-10"
      style={{ background: 'var(--fond)' }}
    >
      <div className="flex w-full max-w-[380px] flex-1 flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="grid size-14 place-items-center rounded-[16px]"
            style={{ background: 'var(--accent)', color: 'var(--sur-accent)' }}
          >
            <Droplet size={26} strokeWidth={2} fill="currentColor" />
          </span>
          <h1 className="mt-4 text-[26px] leading-tight font-medium">Aqua Track</h1>
          <p className="sous-ligne mt-1">
            {etape === 'compte'
              ? 'Identifiez-vous pour commencer'
              : 'Dernière étape : votre kiosque'}
          </p>
        </div>

        {horsReseau && (
          <div className="mb-4">
            <Pastille bloc>
              <WifiOff size={14} strokeWidth={2} className="shrink-0" />
              <span>
                Pas de réseau. La toute première connexion en demande un — ensuite
                l’application s’ouvrira sans internet.
              </span>
            </Pastille>
          </div>
        )}

        {/* --- Étape 1 : le compte ------------------------------------------ */}
        {etape === 'compte' && (
          <div className="flex flex-col gap-3">
            <Champ
              label="Email"
              type="text"
              valeur={email}
              onChange={setEmail}
              placeholder="vous@exemple.com"
            />
            <Champ
              label="Mot de passe"
              type="password"
              valeur={motDePasse}
              onChange={setMotDePasse}
              placeholder="6 caractères minimum"
              onEntree={soumettreCompte}
            />

            <BoutonPlein occupe={occupe} onClick={soumettreCompte}>
              {inscription ? 'Créer le compte' : 'Se connecter'}
            </BoutonPlein>

            <button
              onClick={() => {
                setInscription(!inscription)
                setErreur(null)
              }}
              className="mt-1 text-[13px] underline underline-offset-2"
              style={{ color: 'var(--texte-doux)' }}
            >
              {inscription ? 'J’ai déjà un compte' : 'Créer un compte'}
            </button>
          </div>
        )}

        {/* --- Étape 2 : le kiosque ------------------------------------------ */}
        {etape === 'kiosque' && (
          <div className="flex flex-col gap-3">
            {choixKiosque === null && (
              <>
                <p className="sous-ligne mb-1 text-center">
                  Créez votre kiosque, ou rejoignez celui de votre patron avec son code.
                </p>
                <BoutonPlein onClick={() => setChoixKiosque('creer')} icone={Store}>
                  Créer mon kiosque
                </BoutonPlein>
                <button
                  onClick={() => setChoixKiosque('rejoindre')}
                  className="flex items-center justify-center gap-2 rounded-full py-3 text-sm"
                  style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
                >
                  <UserPlus size={16} strokeWidth={1.75} />
                  Rejoindre avec un code
                </button>
              </>
            )}

            {choixKiosque === 'creer' && (
              <>
                <Champ
                  label="Nom du kiosque"
                  type="text"
                  valeur={nomKiosque}
                  onChange={setNomKiosque}
                  placeholder="Kiosque Delmas"
                />
                <BoutonPlein
                  occupe={occupe}
                  onClick={() =>
                    agir(
                      () => creerKiosque(nomKiosque || 'Mon kiosque'),
                      terminerConfiguration,
                    )
                  }
                >
                  Créer
                </BoutonPlein>
                <Retour onClick={() => setChoixKiosque(null)} />
              </>
            )}

            {choixKiosque === 'rejoindre' && (
              <>
                <Champ
                  label="Code d’invitation"
                  type="text"
                  valeur={code}
                  onChange={(v) => setCode(v.toUpperCase())}
                  placeholder="A1B2C3"
                />
                <BoutonPlein
                  occupe={occupe}
                  onClick={() =>
                    agir(() => rejoindreKiosque(code), () =>
                      terminerConfiguration({ rejoint: true }),
                    )
                  }
                >
                  Rejoindre
                </BoutonPlein>
                <Retour onClick={() => setChoixKiosque(null)} />
              </>
            )}
          </div>
        )}

        {erreur && (
          <div className="mt-4">
            <Pastille bloc>{erreur}</Pastille>
          </div>
        )}
      </div>

      <p
        className="mt-8 max-w-[340px] text-center text-xs"
        style={{ color: 'var(--texte-tres-doux)' }}
      >
        Cette identification n’est demandée qu’à la première ouverture. Ensuite
        l’application fonctionnera sans internet, et vos données resteront sur cet
        appareil.
      </p>
    </div>
  )
}

function Champ({ label, type, valeur, onChange, placeholder, onEntree }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        {label}
      </span>
      <input
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEntree?.()}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        className="w-full rounded-[16px] px-4 py-3.5 text-sm outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--bordure)' }}
      />
    </label>
  )
}

function BoutonPlein({ children, onClick, occupe, icone: Icone }) {
  return (
    <button
      onClick={onClick}
      disabled={occupe}
      className="flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium transition-transform active:scale-[0.99] disabled:opacity-50"
      style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
    >
      {occupe ? <Loader2 size={16} className="animate-spin" /> : Icone && <Icone size={16} />}
      {children}
    </button>
  )
}

function Retour({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-[13px] underline underline-offset-2"
      style={{ color: 'var(--texte-doux)' }}
    >
      Retour
    </button>
  )
}
