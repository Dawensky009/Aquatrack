import { useState } from 'react'
import { Cloud, CloudOff, LogOut, Loader2, MailCheck } from 'lucide-react'
import Pastille from './Pastille.jsx'
import { ChampTexte } from './Champs.jsx'
import { useStore } from '../store/useStore.js'
import { connecter, inscrire, deconnecter, ErreurAuth } from '../lib/auth.js'
import { supabaseConfigure } from '../lib/supabase.js'

/**
 * Sauvegarde en ligne — connexion au compte Supabase.
 *
 * Elle vit dans les Reglages, et non a l'ouverture de l'application : se
 * connecter conditionne la SAUVEGARDE, jamais l'usage. Un ecran de connexion
 * au demarrage rendrait l'app inutilisable hors-ligne, c'est-a-dire au moment
 * precis ou l'on encaisse.
 */
export default function SectionCompte() {
  const session = useStore((s) => s.session)
  const sync = useStore((s) => s.sync)
  const majSession = useStore((s) => s.majSession)
  const recharger = useStore((s) => s.recharger)

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState(null)
  const [inscription, setInscription] = useState(false)

  /* --- Supabase non configure ------------------------------------------- */
  if (!supabaseConfigure) {
    return (
      <section className="carte">
        <h2 className="titre-carte">Sauvegarde en ligne</h2>
        <p className="sous-ligne mt-0.5 mb-4">
          Non configurée. Vos données vivent uniquement sur cet appareil.
        </p>
        <Pastille bloc>
          <CloudOff size={14} strokeWidth={2} className="shrink-0" />
          <span>
            Exportez régulièrement depuis « Vos données » : si vous perdez ce téléphone,
            tout est perdu.
          </span>
        </Pastille>
      </section>
    )
  }

  async function soumettre() {
    if (!email.trim() || motDePasse.length < 6) {
      setMessage('Saisissez un email et un mot de passe d’au moins 6 caractères.')
      return
    }
    setOccupe(true)
    setMessage(null)
    try {
      if (inscription) {
        const { session: s, confirmationRequise } = await inscrire(email, motDePasse)
        if (confirmationRequise) {
          setMessage('Compte créé. Confirmez votre email, puis connectez-vous.')
          setInscription(false)
        } else {
          majSession(s)
          setMessage('Compte créé et connecté.')
        }
      } else {
        majSession(await connecter(email, motDePasse))
        setMessage('Connecté. Vos données vont se synchroniser.')
      }
      setMotDePasse('')
      await recharger()
    } catch (e) {
      setMessage(e instanceof ErreurAuth ? e.message : 'Connexion impossible.')
    } finally {
      setOccupe(false)
    }
  }

  /* --- Connecte ---------------------------------------------------------- */
  if (session) {
    return (
      <section className="carte">
        <h2 className="titre-carte">Sauvegarde en ligne</h2>
        <p className="sous-ligne mt-0.5 mb-4">
          Vos données sont copiées sur le serveur au fil de vos saisies.
        </p>

        <div
          className="flex items-center gap-3 rounded-[14px] px-4 py-3"
          style={{ background: 'var(--surface-doux)' }}
        >
          <Cloud size={17} strokeWidth={1.75} style={{ color: 'var(--vert)' }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{session.user?.email}</span>
            <span className="sous-ligne block">
              {sync.enAttente > 0
                ? `${sync.enAttente} opération${sync.enAttente > 1 ? 's' : ''} en attente d’envoi`
                : 'Tout est sauvegardé'}
            </span>
          </span>
        </div>

        <button
          onClick={async () => {
            setOccupe(true)
            await deconnecter()
            majSession(null)
            setOccupe(false)
            setMessage('Déconnecté. Vos données restent sur cet appareil.')
          }}
          disabled={occupe}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] disabled:opacity-50"
          style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
        >
          <LogOut size={15} strokeWidth={1.75} />
          Se déconnecter
        </button>

        {message && (
          <div className="mt-4">
            <Pastille bloc>{message}</Pastille>
          </div>
        )}

        <p className="sous-ligne mt-4">
          Se déconnecter n’efface rien : l’application continue de fonctionner en local,
          seule la sauvegarde s’arrête.
        </p>
      </section>
    )
  }

  /* --- Configure, deconnecte --------------------------------------------- */
  return (
    <section className="carte">
      <h2 className="titre-carte">Sauvegarde en ligne</h2>
      <p className="sous-ligne mt-0.5 mb-4">
        {inscription
          ? 'Créez votre compte pour sauvegarder vos données hors de ce téléphone.'
          : 'Connectez-vous pour sauvegarder vos données hors de ce téléphone.'}
      </p>

      <div className="flex flex-col gap-3">
        <ChampTexte label="Email" valeur={email} onChange={setEmail} placeholder="vous@exemple.com" />

        <label className="block">
          <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
            Mot de passe
          </span>
          <input
            type="password"
            value={motDePasse}
            autoComplete={inscription ? 'new-password' : 'current-password'}
            onChange={(e) => setMotDePasse(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && soumettre()}
            placeholder="6 caractères minimum"
            className="w-full rounded-[16px] px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surface-doux)' }}
          />
        </label>

        <button
          onClick={soumettre}
          disabled={occupe}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
        >
          {occupe && <Loader2 size={16} className="animate-spin" />}
          {inscription ? 'Créer le compte' : 'Se connecter'}
        </button>

        <button
          onClick={() => {
            setInscription(!inscription)
            setMessage(null)
          }}
          className="text-[13px] underline underline-offset-2"
          style={{ color: 'var(--texte-doux)' }}
        >
          {inscription ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>
      </div>

      {message && (
        <div className="mt-4">
          <Pastille bloc>
            <MailCheck size={14} strokeWidth={2} className="shrink-0" />
            <span>{message}</span>
          </Pastille>
        </div>
      )}

      {/* Les operations saisies hors connexion ne sont pas perdues : elles
          attendent dans la file et partiront des la premiere connexion. */}
      {sync.enAttente > 0 && (
        <p className="sous-ligne mt-4">
          {sync.enAttente} opération{sync.enAttente > 1 ? 's' : ''} attend
          {sync.enAttente > 1 ? 'ent' : ''} d’être sauvegardée
          {sync.enAttente > 1 ? 's' : ''} — elles partiront dès la connexion.
        </p>
      )}
    </section>
  )
}
