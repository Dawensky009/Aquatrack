import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudOff, LogOut, Loader2, MailCheck, Store, UserPlus, Copy, Check, X } from 'lucide-react'
import Pastille from './Pastille.jsx'
import { ChampTexte } from './Champs.jsx'
import { useStore } from '../store/useStore.js'
import {
  connecter,
  inscrire,
  deconnecter,
  monKiosque,
  creerKiosque,
  rejoindreKiosque,
  membresKiosque,
  retirerMembre,
  ErreurAuth,
} from '../lib/auth.js'
import { supabaseConfigure } from '../lib/supabase.js'
import { abandonnerCategoriesParDefaut } from '../lib/db.js'

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
  const rafraichirSync = useStore((s) => s.rafraichirSync)

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState(null)
  const [inscription, setInscription] = useState(false)

  const [kiosque, setKiosque] = useState(null)
  const [membres, setMembres] = useState([])

  const rafraichirKiosque = useCallback(async () => {
    if (!session) return setKiosque(null)
    const k = await monKiosque()
    setKiosque(k)
    setMembres(k ? await membresKiosque() : [])
    rafraichirSync()
  }, [session, rafraichirSync])

  useEffect(() => {
    rafraichirKiosque()
  }, [rafraichirKiosque])

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

        <BlocKiosque
          kiosque={kiosque}
          membres={membres}
          emailCourant={session.user?.email}
          idCourant={session.user?.id}
          onChange={rafraichirKiosque}
        />

        <button
          onClick={async () => {
            if (
              !confirm(
                'Se déconnecter ?\n\n' +
                  'Vos données restent sur cet appareil, mais la prochaine ouverture ' +
                  'de l’application redemandera votre email et votre mot de passe.',
              )
            )
              return
            setOccupe(true)
            await deconnecter()
            majSession(null)
            useStore.setState({ appareilConfigure: false })
            setOccupe(false)
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

      {/* Une ligne que le serveur refuse durablement est mise de côté pour ne
          pas bloquer les autres. Le dire explicitement : la sauvegarde
          distante est incomplète, même si l’appareil, lui, a tout. */}
      {sync.bloques > 0 && (
        <div className="mt-3">
          <Pastille bloc>
            {sync.bloques} opération{sync.bloques > 1 ? 's' : ''} n’a
            {sync.bloques > 1 ? 'ont' : ''} pas pu être sauvegardée
            {sync.bloques > 1 ? 's' : ''} en ligne. Vos chiffres restent complets sur
            cet appareil — pensez à faire un export.
          </Pastille>
        </div>
      )}
    </section>
  )
}

/**
 * Le kiosque — l'unite de partage.
 *
 * Les donnees appartiennent au kiosque, pas au compte. Le proprietaire en cree
 * un ; l'employe le rejoint avec un code a six caracteres. Tous deux voient
 * alors exactement les memes chiffres, et chaque ligne garde la trace de qui
 * l'a saisie.
 */
function BlocKiosque({ kiosque, membres, idCourant, onChange }) {
  const [mode, setMode] = useState(null) // null | 'creer' | 'rejoindre'
  const [nom, setNom] = useState('')
  const [code, setCode] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [copie, setCopie] = useState(false)

  const moi = membres.find((m) => m.user_id === idCourant)
  const suisProprietaire = moi?.role === 'proprietaire'

  async function agir(action) {
    setOccupe(true)
    setErreur(null)
    try {
      await action()
      await onChange()
      setMode(null)
      setCode('')
    } catch (e) {
      setErreur(e instanceof ErreurAuth ? e.message : 'Opération impossible.')
    } finally {
      setOccupe(false)
    }
  }

  /* --- Pas encore de kiosque --------------------------------------------- */
  if (!kiosque) {
    return (
      <div className="mt-4">
        <Pastille bloc>
          Votre compte n’est rattaché à aucun kiosque. Créez le vôtre, ou rejoignez celui
          de votre patron avec son code.
        </Pastille>

        {mode === null && (
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setMode('creer')}
              className="flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-medium"
              style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
            >
              <Store size={15} strokeWidth={2} />
              Créer mon kiosque
            </button>
            <button
              onClick={() => setMode('rejoindre')}
              className="flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px]"
              style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
            >
              <UserPlus size={15} strokeWidth={1.75} />
              Rejoindre avec un code
            </button>
          </div>
        )}

        {mode === 'creer' && (
          <div className="mt-3 flex flex-col gap-3">
            <ChampTexte
              label="Nom du kiosque"
              valeur={nom}
              onChange={setNom}
              placeholder="Kiosque Delmas"
            />
            <Actions
              occupe={occupe}
              libelle="Créer"
              onValider={() => agir(() => creerKiosque(nom || 'Mon kiosque'))}
              onAnnuler={() => setMode(null)}
            />
          </div>
        )}

        {mode === 'rejoindre' && (
          <div className="mt-3 flex flex-col gap-3">
            <ChampTexte
              label="Code d’invitation"
              valeur={code}
              onChange={(v) => setCode(v.toUpperCase())}
              placeholder="A1B2C3"
            />
            <Actions
              occupe={occupe}
              libelle="Rejoindre"
              onValider={() =>
                agir(async () => {
                  await rejoindreKiosque(code)
                  // Les categories amorcees d'office feraient doublon avec
                  // celles du kiosque rejoint. Sans effet si l'appareil a deja
                  // une histoire propre.
                  await abandonnerCategoriesParDefaut()
                })
              }
              onAnnuler={() => setMode(null)}
            />
          </div>
        )}

        {erreur && (
          <div className="mt-3">
            <Pastille bloc>{erreur}</Pastille>
          </div>
        )}
      </div>
    )
  }

  /* --- Kiosque actif ------------------------------------------------------ */
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2.5">
        <Store size={16} strokeWidth={1.75} style={{ color: 'var(--texte-doux)' }} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{kiosque.nom}</span>
        <span className="sous-ligne shrink-0">
          {membres.length} membre{membres.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Le code n'est montre qu'au proprietaire : c'est lui qui decide qui
          entre. L'afficher a l'employe reviendrait a lui donner le pouvoir
          d'ouvrir la comptabilite a n'importe qui. */}
      {suisProprietaire && (
        <div className="mt-3">
          <p className="sous-ligne mb-1.5">Code à donner à votre employé</p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(kiosque.code_invitation)
              setCopie(true)
              setTimeout(() => setCopie(false), 2000)
            }}
            className="flex w-full items-center justify-between gap-2 rounded-[14px] px-4 py-3"
            style={{ background: 'var(--surface-doux)' }}
          >
            <span className="chiffres text-lg tracking-[0.25em]">
              {kiosque.code_invitation}
            </span>
            {copie ? (
              <Check size={16} strokeWidth={2.25} style={{ color: 'var(--vert)' }} />
            ) : (
              <Copy size={16} strokeWidth={1.75} style={{ color: 'var(--texte-doux)' }} />
            )}
          </button>
        </div>
      )}

      <ul className="mt-3 flex flex-col">
        {membres.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center gap-2.5 py-2"
            style={{ borderTop: '1px solid var(--bordure)' }}
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {m.nom || (m.user_id === idCourant ? 'Vous' : 'Membre')}
              {m.user_id === idCourant && m.nom && ' (vous)'}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
            >
              {m.role === 'proprietaire' ? 'Propriétaire' : 'Employé'}
            </span>
            {suisProprietaire && m.user_id !== idCourant && (
              <button
                onClick={() => agir(() => retirerMembre(m.user_id))}
                aria-label="Retirer ce membre"
                className="shrink-0 p-1"
                style={{ color: 'var(--texte-tres-doux)' }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {erreur && (
        <div className="mt-3">
          <Pastille bloc>{erreur}</Pastille>
        </div>
      )}
    </div>
  )
}

function Actions({ occupe, libelle, onValider, onAnnuler }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onValider}
        disabled={occupe}
        className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-medium disabled:opacity-50"
        style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
      >
        {occupe && <Loader2 size={14} className="animate-spin" />}
        {libelle}
      </button>
      <button
        onClick={onAnnuler}
        className="px-3 text-[13px]"
        style={{ color: 'var(--texte-doux)' }}
      >
        Annuler
      </button>
    </div>
  )
}
