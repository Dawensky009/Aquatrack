/**
 * Barre de repartition en deux segments — motif « 23% / 77% » de la carte
 * bleue de all_screen.png.
 *
 * Deux segments a coins arrondis separes d'un fin intervalle, chacun portant
 * son pourcentage a l'interieur, avec une legende a pastilles en dessous.
 *
 * Decline sur fond bleu (carte Revenus vs Depenses) et sur fond blanc
 * (Modes de paiement, repartition cout / marge).
 */
export default function BarreSplit({ gauche, droite, surSombre = false, className = '' }) {
  const total = (gauche.valeur || 0) + (droite.valeur || 0)
  if (total <= 0) return null

  const partGauche = (gauche.valeur / total) * 100
  const partDroite = 100 - partGauche

  // En dessous de ~12 %, le pourcentage ne tient plus dans le segment.
  const lisible = (p) => p >= 12

  // Le segment de gauche est le clair, celui de droite le sombre — comme dans
  // la maquette. Sur la carte bleue le clair devient blanc pur pour trancher
  // sur l'accent ; ailleurs il prend la surface douce du theme.
  const fondGauche = gauche.couleur ?? (surSombre ? 'var(--sur-hero)' : 'var(--surface-doux)')
  const texteGauche = gauche.texte ?? (surSombre ? 'var(--hero)' : 'var(--texte)')
  // Sur la carte bleue, le segment droit reste SOMBRE dans les deux themes.
  // Utiliser --action l'aurait rendu clair en mode sombre, et la barre aurait
  // alors montre deux segments clairs sur bleu — le contraste blanc/noir de la
  // maquette aurait disparu.
  const fondDroite = droite.couleur ?? (surSombre ? 'var(--hero)' : 'var(--action)')
  const texteDroite = droite.texte ?? (surSombre ? 'var(--sur-hero)' : 'var(--sur-action)')

  const pct = (p) => `${Math.round(p)} %`

  return (
    <div className={className}>
      <div className="flex h-13 gap-1" style={{ height: 52 }}>
        <div
          className="flex items-center rounded-[14px] px-3"
          style={{ width: `${partGauche}%`, background: fondGauche, color: texteGauche }}
        >
          {lisible(partGauche) && (
            <span className="chiffres text-sm font-medium">{pct(partGauche)}</span>
          )}
        </div>
        <div
          className="flex items-center rounded-[14px] px-3"
          style={{ width: `${partDroite}%`, background: fondDroite, color: texteDroite }}
        >
          {lisible(partDroite) && (
            <span className="chiffres text-sm font-medium">{pct(partDroite)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <Legende libelle={gauche.libelle} couleur={fondGauche} surSombre={surSombre} />
        <Legende libelle={droite.libelle} couleur={fondDroite} surSombre={surSombre} />
      </div>
    </div>
  )
}

function Legende({ libelle, couleur, surSombre }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ color: surSombre ? 'var(--sur-hero-doux)' : 'var(--texte-doux)' }}
    >
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ background: couleur, outline: '1px solid rgb(0 0 0 / .06)' }}
      />
      {libelle}
    </span>
  )
}
