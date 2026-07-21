import { useEffect, useState } from 'react'
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react'
import Pastille from './Pastille.jsx'
import EnTeteCarte from './EnTeteCarte.jsx'
import SegmentPills from './SegmentPills.jsx'
import { useStore, useEtat } from '../store/useStore.js'
import { DELAIS, biometrieDisponible, enrolerBiometrie, verifierCode } from '../lib/verrou.js'

/**
 * Reglages de securite.
 *
 * L'ordre suit la logique d'activation : d'abord un code, ensuite seulement le
 * delai et la biometrie. La biometrie ne remplace jamais le code — un capteur
 * qui refuse un doigt mouille (frequent au comptoir) laisserait sinon
 * l'utilisateur dehors de ses propres donnees.
 */
export default function SectionSecurite() {
  const etat = useEtat()
  const definirCode = useStore((s) => s.definirCode)
  const retirerVerrou = useStore((s) => s.retirerVerrou)
  const majReglages = useStore((s) => s.majReglages)

  const r = etat.reglages
  const [etape, setEtape] = useState(null) // null | 'nouveau' | 'confirmer' | 'retirer'
  const [saisie, setSaisie] = useState('')
  const [premier, setPremier] = useState('')
  const [message, setMessage] = useState(null)
  const [capteur, setCapteur] = useState(false)

  useEffect(() => {
    biometrieDisponible().then(setCapteur)
  }, [])

  function reinitialiser() {
    setEtape(null)
    setSaisie('')
    setPremier('')
  }

  async function soumettre() {
    if (saisie.length !== 4) return

    if (etape === 'nouveau') {
      setPremier(saisie)
      setSaisie('')
      setEtape('confirmer')
      return
    }

    if (etape === 'confirmer') {
      if (saisie !== premier) {
        setMessage('Les deux codes ne correspondent pas. Recommencez.')
        setSaisie('')
        setPremier('')
        setEtape('nouveau')
        return
      }
      await definirCode(saisie)
      setMessage('Verrouillage activé.')
      reinitialiser()
      return
    }

    if (etape === 'retirer') {
      // On redemande le code avant de desactiver : sans cela, quiconque a
      // l'app ouverte pourrait retirer la protection en deux taps.
      const ok = await verifierCode(saisie, r.verrou_sel, r.verrou_empreinte)
      if (!ok) {
        setMessage('Code incorrect.')
        setSaisie('')
        return
      }
      await retirerVerrou()
      setMessage('Verrouillage désactivé.')
      reinitialiser()
    }
  }

  async function basculerBiometrie(actif) {
    if (!actif) return majReglages({ verrou_biometrie: null })
    try {
      const id = await enrolerBiometrie(r.nom_utilisateur)
      await majReglages({ verrou_biometrie: id })
      setMessage('Empreinte enregistrée.')
    } catch {
      setMessage("L'enrôlement a échoué ou a été annulé.")
    }
  }

  return (
    <section className="carte">
      <EnTeteCarte icone={ShieldCheck} titre="Sécurité" />
      <p className="sous-ligne mt-0.5 mb-4">
        Un code à 4 chiffres à l'ouverture, pour que le téléphone posé sur le comptoir ne
        laisse pas voir vos chiffres.
      </p>

      {!r.verrou_actif ? (
        etape ? (
          <SaisieCode
            titre={etape === 'confirmer' ? 'Confirmez le code' : 'Nouveau code à 4 chiffres'}
            saisie={saisie}
            onChange={setSaisie}
            onValider={soumettre}
            onAnnuler={reinitialiser}
          />
        ) : (
          <button
            onClick={() => setEtape('nouveau')}
            className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left text-sm"
            style={{ background: 'var(--surface-doux)' }}
          >
            <Lock size={17} strokeWidth={1.75} style={{ color: 'var(--texte-doux)' }} />
            Activer le verrouillage
          </button>
        )
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className="flex items-center gap-2.5 rounded-[14px] px-4 py-3 text-sm"
            style={{ background: 'var(--surface-doux)' }}
          >
            <ShieldCheck size={17} strokeWidth={1.75} style={{ color: 'var(--vert)' }} />
            Verrouillage actif
          </div>

          <div>
            <p className="mb-2 text-[13px]" style={{ color: 'var(--texte-doux)' }}>
              Verrouiller après
            </p>
            <SegmentPills
              taille="compacte"
              valeur={r.verrou_delai}
              onChange={(v) => majReglages({ verrou_delai: v })}
              options={DELAIS.map((d) => ({ valeur: d.valeur, libelle: d.libelle }))}
            />
            <p className="sous-ligne mt-2">
              {DELAIS.find((d) => d.valeur === r.verrou_delai)?.aide}. L'application se
              verrouille toujours à un démarrage complet.
            </p>
          </div>

          {capteur && (
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm">
                  <Fingerprint size={16} strokeWidth={1.75} />
                  Empreinte ou visage
                </span>
                <span className="sous-ligne mt-0.5 block">
                  Déverrouillage sans saisir le code. Le code reste toujours disponible en
                  secours.
                </span>
              </span>
              <Interrupteur
                actif={!!r.verrou_biometrie}
                onChange={basculerBiometrie}
              />
            </label>
          )}

          {etape === 'retirer' ? (
            <SaisieCode
              titre="Saisissez votre code pour désactiver"
              saisie={saisie}
              onChange={setSaisie}
              onValider={soumettre}
              onAnnuler={reinitialiser}
            />
          ) : (
            <button
              onClick={() => setEtape('retirer')}
              className="self-start text-[13px] underline underline-offset-2"
              style={{ color: 'var(--texte-doux)' }}
            >
              Désactiver le verrouillage
            </button>
          )}
        </div>
      )}

      {message && (
        <div className="mt-4">
          <Pastille bloc>{message}</Pastille>
        </div>
      )}

      <p className="sous-ligne mt-4">
        Ce verrou protège contre quelqu'un qui prend le téléphone en main. Il ne chiffre pas
        vos données : gardez aussi le téléphone protégé par le verrouillage du système.
      </p>
    </section>
  )
}

function SaisieCode({ titre, saisie, onChange, onValider, onAnnuler }) {
  return (
    <div>
      <p className="mb-2 text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        {titre}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={saisie}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && onValider()}
          placeholder="••••"
          autoFocus
          className="chiffres w-28 rounded-[14px] px-4 py-2.5 text-center text-lg tracking-[0.4em] outline-none"
          style={{ background: 'var(--surface-doux)' }}
        />
        <button
          onClick={onValider}
          disabled={saisie.length !== 4}
          className="rounded-[14px] px-4 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
        >
          Valider
        </button>
        <button
          onClick={onAnnuler}
          className="px-2 text-[13px]"
          style={{ color: 'var(--texte-doux)' }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

function Interrupteur({ actif, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={actif}
      onClick={() => onChange(!actif)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: actif ? 'var(--accent)' : 'var(--gris-data)' }}
    >
      <span
        className="absolute top-1 size-5 rounded-full transition-all"
        style={{ background: '#FFFFFF', left: actif ? 26 : 4 }}
      />
    </button>
  )
}
