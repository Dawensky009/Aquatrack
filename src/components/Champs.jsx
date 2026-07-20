import { cleJour, formatDateCourte } from '../lib/format.js'

/**
 * Champs de saisie.
 *
 * La saisie se fait debout, au comptoir, souvent d'une seule main : les
 * cibles sont larges et le clavier numerique est force partout ou c'est
 * pertinent (`inputMode="decimal"` plutot que `type="number"`, qui affiche
 * des fleches inutiles et accepte la molette par erreur).
 */

/** Grand champ de montant — 34px, suffixe d'unite, valeur derivee dessous. */
export function ChampMontant({
  label,
  valeur,
  onChange,
  unite = 'HTG',
  aide,
  auto = false,
  lectureSeule = false,
  autoFocus = false,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        {label}
      </span>
      <span
        className="flex items-baseline gap-2 rounded-[16px] px-4 py-3"
        style={{
          background: lectureSeule ? 'transparent' : 'var(--surface-doux)',
          border: lectureSeule ? '1px dashed var(--bordure)' : '1px solid transparent',
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={valeur}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={lectureSeule}
          autoFocus={autoFocus}
          placeholder="0"
          className="chiffre-hero w-full min-w-0 bg-transparent outline-none"
          style={{ color: lectureSeule ? 'var(--texte-doux)' : 'var(--texte)' }}
        />
        <span className="shrink-0 text-sm" style={{ color: 'var(--texte-doux)' }}>
          {unite}
        </span>
      </span>
      {aide && (
        <span
          className="mt-1.5 block text-xs"
          style={{ color: auto ? 'var(--texte-doux)' : 'var(--texte)' }}
        >
          {aide}
        </span>
      )}
    </label>
  )
}

/** Champ compact, pour les valeurs secondaires (MonCash, gallons reçus…). */
export function ChampNombre({ label, valeur, onChange, unite, aide, lectureSeule = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        {label}
      </span>
      <span
        className="flex items-baseline gap-2 rounded-[16px] px-4 py-2.5"
        style={{
          background: lectureSeule ? 'transparent' : 'var(--surface-doux)',
          border: lectureSeule ? '1px dashed var(--bordure)' : '1px solid transparent',
        }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={valeur}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={lectureSeule}
          placeholder="0"
          className="chiffres w-full min-w-0 bg-transparent text-lg outline-none"
          style={{ color: lectureSeule ? 'var(--texte-doux)' : 'var(--texte)' }}
        />
        {unite && (
          <span className="shrink-0 text-xs" style={{ color: 'var(--texte-doux)' }}>
            {unite}
          </span>
        )}
      </span>
      {aide && <span className="sous-ligne mt-1.5 block">{aide}</span>}
    </label>
  )
}

export function ChampTexte({ label, valeur, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
        {label}
      </span>
      <input
        type="text"
        value={valeur}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[16px] px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface-doux)' }}
      />
    </label>
  )
}

/**
 * Date de l'operation.
 *
 * `<input type="date">` natif : sur mobile il ouvre le selecteur du systeme,
 * deja traduit et deja familier. Aucune librairie, et cela fonctionne
 * hors-ligne — deux raisons suffisantes de ne pas faire autrement.
 *
 * Les raccourcis « Aujourd'hui » / « Hier » couvrent le cas de loin le plus
 * frequent : on cloture le soir meme, ou le lendemain matin.
 */
export function ChampDate({ label = 'Date', valeur, onChange, max }) {
  const aujourdhui = cleJour()
  const hier = cleJour(new Date(Date.now() - 86_400_000))

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
          {label}
        </span>
        <div className="flex gap-1.5">
          {[
            { cle: aujourdhui, libelle: "Aujourd'hui" },
            { cle: hier, libelle: 'Hier' },
          ].map((r) => (
            <button
              key={r.cle}
              onClick={() => onChange(r.cle)}
              className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
              style={{
                background: valeur === r.cle ? 'var(--action)' : 'var(--surface-doux)',
                color: valeur === r.cle ? 'var(--sur-action)' : 'var(--texte-doux)',
              }}
            >
              {r.libelle}
            </button>
          ))}
        </div>
      </div>
      <input
        type="date"
        value={valeur}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-full rounded-[16px] px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface-doux)' }}
      />
      <span className="sous-ligne mt-1.5 block">{formatDateCourte(valeur)}</span>
    </div>
  )
}

/** Rangee de pilules a choix unique — categories, mode de paiement. */
export function Pilules({ options, valeur, onChange, label }) {
  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
          {label}
        </span>
      )}
      <div className="defile-x flex gap-2 pb-1">
        {options.map((o) => {
          const actif = o.valeur === valeur
          return (
            <button
              key={o.valeur}
              onClick={() => onChange(o.valeur)}
              className="shrink-0 rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors"
              style={{
                background: actif ? 'var(--action)' : 'var(--surface-doux)',
                color: actif ? 'var(--sur-action)' : 'var(--texte-doux)',
                fontWeight: actif ? 500 : 400,
              }}
            >
              {o.libelle}
            </button>
          )
        })}
      </div>
    </div>
  )
}
