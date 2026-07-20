import { Droplet, Truck, Package, Paperclip } from 'lucide-react'
import { formatHTG, formatGallons, formatPrix, formatDateCourte } from '../lib/format.js'
import { couleurDonnees } from '../lib/theme.js'
import { useSombre } from '../store/useStore.js'

/**
 * Ligne du journal — motif « Top products » de all_screen.png : vignette
 * arrondie a gauche, libelle et sous-ligne au centre, montant a droite.
 *
 * Deux natures de ligne :
 *   - une cloture de journee (revenu)
 *   - une depense (reapprovisionnement ou materiel)
 *
 * Le badge vert « Revenu » est la seule couleur hors planche de branding.
 * Les depenses restent en noir sur gris : introduire du rouge casserait
 * l'identite visuelle pour une information que le signe « − » porte deja.
 */
export default function LigneJournal({ ligne, onClick }) {
  const revenu = ligne.type === 'revenu'
  const sombre = useSombre()
  const couleur = couleurDonnees(ligne.couleur, sombre)
  const Icone = revenu ? Droplet : ligne.suitGallons ? Truck : Package

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-60"
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-[12px]"
        style={{
          background: revenu ? 'var(--surface-doux)' : `${couleur}22`,
          color: revenu ? 'var(--texte)' : couleur,
        }}
      >
        <Icone size={19} strokeWidth={1.75} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{ligne.libelle}</span>
        <span className="sous-ligne flex items-center gap-1.5 truncate">
          {/* Trombone : dit d'un coup d'oeil quelles dépenses sont justifiées
              par un reçu, sans avoir à ouvrir chaque ligne. */}
          {ligne.nbRecus > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <Paperclip size={11} strokeWidth={2} />
              {ligne.nbRecus > 1 && ligne.nbRecus}
            </span>
          )}
          <span className="truncate">{ligne.detail}</span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="chiffres block text-sm font-medium">
          {formatHTG(revenu ? ligne.montant : -ligne.montant, { signe: true })}
        </span>
        <span
          className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={
            revenu
              ? { background: 'var(--vert-clair)', color: 'var(--vert)' }
              : { background: 'var(--surface-doux)', color: 'var(--texte-doux)' }
          }
        >
          {revenu ? 'Revenu' : 'Dépense'}
        </span>
      </span>
    </button>
  )
}

/**
 * Convertit une journee ou une depense en une ligne d'affichage uniforme.
 * Regroupe ici la mise en forme pour que le tableau de bord et le journal
 * affichent rigoureusement la meme chose.
 */
export function versLigne(source, { categories = [], recus = [] } = {}) {
  if (source.date !== undefined) {
    return {
      cle: `j-${source.id}`,
      type: 'revenu',
      tri: `${source.date}T23:59:59`,
      libelle: `Recette du ${formatDateCourte(source.date)}`,
      detail: `${formatGallons(source.gallons)} · ${formatPrix(source.prix_reference)}/gallon${
        source.gallons_source === 'compteur' ? ' · compteur' : ''
      }`,
      montant: source.montant,
      source,
    }
  }

  const cat = categories.find((c) => c.id === source.category_id)
  const appro = !!cat?.suit_gallons

  // Un achat de matériel porte le nom de l'article ; c'est lui qui permet de
  // retrouver « les bouchons » parmi douze lignes « Achat matériel ».
  const libelle = (!appro && source.designation) || cat?.nom || 'Dépense'

  let detail
  if (appro && source.quantity > 0) {
    detail = `${formatGallons(source.quantity)} · ${formatPrix(source.total / source.quantity)}/gallon`
  } else if (source.quantity > 1) {
    detail = `${cat?.nom ?? ''} · ${source.quantity} × ${formatPrix(source.total / source.quantity)}`
  } else {
    detail = cat?.nom ?? 'Dépense'
  }

  return {
    cle: `d-${source.id}`,
    type: 'depense',
    tri: source.occurred_at,
    libelle,
    detail,
    montant: source.total,
    couleur: cat?.color ?? '#222026',
    suitGallons: !!cat?.suit_gallons,
    nbRecus: recus.filter((r) => r.depense_id === source.id).length,
    source,
  }
}
