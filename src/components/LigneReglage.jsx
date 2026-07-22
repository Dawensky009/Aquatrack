import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { lireNombre } from '../lib/format.js'

/**
 * Vocabulaire de la liste de reglages.
 *
 * Un panneau de reglages se PARCOURT du pouce, il ne se lit pas. La reference
 * qui convient n'est donc pas la carte-formulaire mais la liste groupee : des
 * lignes courtes — icone, libelle, valeur ou interrupteur a droite — reunies
 * par sujet dans une meme carte, un intertitre au-dessus, une note en dessous.
 *
 * Tout tient dans trois briques : le groupe, la ligne, et deux valeurs
 * editables en place. Elles partagent une seule grammaire visuelle, ce qui
 * rend l'ecran previsible : on sait ou toucher avant d'avoir lu.
 */

/** Une carte de groupe : intertitre, lignes, et note de bas de groupe. */
export function GroupeReglage({ titre, children, aide }) {
  return (
    <section>
      {titre && (
        <h2 className="mb-1.5 px-1 text-[13px] font-medium" style={{ color: 'var(--texte-doux)' }}>
          {titre}
        </h2>
      )}
      <div
        className="overflow-hidden rounded-[16px]"
        style={{ background: 'var(--surface)', border: '1px solid var(--bordure)' }}
      >
        {children}
      </div>
      {aide && <p className="sous-ligne mt-1.5 px-1">{aide}</p>}
    </section>
  )
}

/**
 * Une ligne. Cliquable (navigation, action) ou statique (elle porte un
 * interrupteur ou une valeur editable a droite).
 *
 * Le filet de separation est porte par la ligne elle-meme, sauf la derniere :
 * c'est la carte qui ferme le bas. `danger` teinte de rouge ce qui efface.
 */
export function LigneReglage({
  icone: Icone,
  titre,
  sousTitre,
  valeur,
  trailing,
  onClick,
  chevron = false,
  danger = false,
}) {
  const Comp = onClick ? 'button' : 'div'
  const encre = danger ? 'var(--rouge)' : 'var(--texte)'

  return (
    <Comp
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left [&:not(:last-child)]:border-b ${
        onClick ? 'transition-colors active:bg-[var(--surface-doux)]' : ''
      }`}
      style={{ borderColor: 'var(--bordure)' }}
    >
      {Icone && (
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px]"
          style={{
            background: danger
              ? 'color-mix(in srgb, var(--rouge) 14%, transparent)'
              : 'var(--surface-doux)',
            color: danger ? 'var(--rouge)' : 'var(--texte-doux)',
          }}
        >
          <Icone size={16.5} strokeWidth={1.75} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm" style={{ color: encre }}>
          {titre}
        </span>
        {sousTitre && <span className="sous-ligne mt-0.5 block">{sousTitre}</span>}
      </span>

      {valeur != null && (
        <span className="chiffres shrink-0 text-sm" style={{ color: 'var(--texte-doux)' }}>
          {valeur}
        </span>
      )}
      {trailing}
      {chevron && (
        <ChevronRight size={17} strokeWidth={2} style={{ color: 'var(--texte-tres-doux)' }} />
      )}
    </Comp>
  )
}

/**
 * Valeur numerique editee sur place, a droite de sa ligne.
 *
 * Meme regle que le champ de reglage plein : un brouillon local, enregistre a
 * la SORTIE du champ. Piloter directement la valeur enregistree empechait de
 * vider le champ ou d'y taper une decimale — la saisie etait relue et ecrasee
 * a chaque frappe.
 */
export function ValeurNombre({ valeur, onValider, unite, min = 0 }) {
  const [brouillon, setBrouillon] = useState(String(valeur ?? ''))
  const [edite, setEdite] = useState(false)

  useEffect(() => {
    if (!edite) setBrouillon(String(valeur ?? ''))
  }, [valeur, edite])

  function valider() {
    setEdite(false)
    const n = lireNombre(brouillon)
    if (n != null && n > min) onValider(n)
    else setBrouillon(String(valeur ?? ''))
  }

  return (
    <span className="flex shrink-0 items-baseline gap-1">
      <input
        inputMode="decimal"
        value={brouillon}
        onFocus={() => setEdite(true)}
        onChange={(e) => {
          setEdite(true)
          setBrouillon(e.target.value)
        }}
        onBlur={valider}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="chiffres w-16 rounded-md bg-transparent py-0.5 text-right text-sm outline-none focus:bg-[var(--surface-doux)]"
        style={{ color: 'var(--texte)' }}
      />
      {unite && (
        <span className="text-xs" style={{ color: 'var(--texte-doux)' }}>
          {unite}
        </span>
      )}
    </span>
  )
}

/** Valeur texte editee sur place. Utile pour le nom. */
export function ValeurTexte({ valeur, onValider, placeholder }) {
  const [brouillon, setBrouillon] = useState(valeur ?? '')
  const [edite, setEdite] = useState(false)

  useEffect(() => {
    if (!edite) setBrouillon(valeur ?? '')
  }, [valeur, edite])

  return (
    <input
      value={brouillon}
      placeholder={placeholder}
      onFocus={() => setEdite(true)}
      onChange={(e) => {
        setEdite(true)
        setBrouillon(e.target.value)
      }}
      onBlur={() => {
        setEdite(false)
        if (brouillon !== valeur) onValider(brouillon)
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-36 shrink-0 rounded-md bg-transparent py-0.5 text-right text-sm outline-none focus:bg-[var(--surface-doux)]"
      style={{ color: 'var(--texte)' }}
    />
  )
}

/** Interrupteur — partage entre les lignes et les cartes de reglages. */
export function Interrupteur({ actif, onChange }) {
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
