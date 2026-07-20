import { useEffect, useState } from 'react'
import { Truck, Droplet, Package, Pencil } from 'lucide-react'
import Feuille from './Feuille.jsx'
import Pastille from './Pastille.jsx'
import { lireImageRecu } from '../lib/db.js'
import { useStore, useEtat, useSombre } from '../store/useStore.js'
import { couleurDonnees } from '../lib/theme.js'
import * as M from '../lib/metrics.js'
import {
  formatHTG,
  formatPrix,
  formatGallons,
  formatDateCourte,
  formatDateLongue,
} from '../lib/format.js'

/**
 * Detail d'une livraison.
 *
 * Repond a « ce camion, il m'a rapporte combien, et comment ? » en montrant
 * la chaine complete : l'achat, les ventes qu'il a alimentees jour par jour,
 * les depenses de la periode, et ce qui reste au bout.
 *
 * Le calcul se refait a l'ouverture plutot que d'etre passe en parametre :
 * modifier une vente depuis le journal doit se refleter ici sans que la
 * feuille ait a etre reconstruite.
 */
export default function FeuilleLot({ lotId }) {
  const etat = useEtat()
  const fermerFeuille = useStore((s) => s.fermerFeuille)
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)
  const sombre = useSombre()

  const lot = M.detailApprovisionnement(etat, lotId)
  const achat = etat.depenses.find((d) => d.id === lotId)
  const recus = etat.recus.filter((r) => r.depense_id === lotId)

  if (!lot) {
    return (
      <Feuille titre="Livraison" onFermer={fermerFeuille}>
        <p className="sous-ligne pb-6">Cette livraison n'existe plus.</p>
      </Feuille>
    )
  }

  const pourcent = Math.round(lot.part * 100)
  const enCours = lot.statut === 'en-cours'

  return (
    <Feuille titre={`Camion du ${formatDateCourte(lot.date)}`} onFermer={fermerFeuille}>
      <div className="flex flex-col gap-5 pb-4">
        {/* --- Ce qui reste en poche ------------------------------------- */}
        <section
          className="rounded-[16px] p-4"
          style={{ background: 'var(--hero)', color: 'var(--sur-hero)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--sur-hero-doux)' }}>
            {lot.vendus > 0 ? 'Bénéfice net de cette livraison' : 'Pas encore entamé'}
          </p>
          <p className="chiffre-hero mt-1">
            {lot.vendus > 0 ? formatHTG(lot.beneficeNet) : '—'}
          </p>
          {lot.vendus > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--sur-hero-doux)' }}>
              {formatHTG(lot.revenu)} encaissés · {formatHTG(lot.coutEcoule)} d'eau ·{' '}
              {formatHTG(lot.totalAutresDepenses)} d'autres dépenses
            </p>
          )}

          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--sur-hero-faible)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, pourcent)}%`,
                background: enCours ? 'var(--accent)' : 'var(--sur-hero)',
              }}
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--sur-hero-doux)' }}>
            {pourcent} % écoulé
            {lot.restant > 1 && ` · ${formatGallons(lot.restant)} encore en citerne`}
            {lot.jours != null && ` · ${lot.jours} jours`}
          </p>
        </section>

        {/* --- L'achat --------------------------------------------------- */}
        <Bloc titre="L'achat">
          <Ligne
            icone={Truck}
            couleur={couleurDonnees('#222026', sombre)}
            libelle={`${formatGallons(lot.gallons)} à ${formatPrix(lot.coutGallon)}`}
            detail={formatDateLongue(lot.date)}
            montant={-lot.cout}
            onClick={achat ? () => ouvrirFeuille('depense', achat) : undefined}
          />

          {recus.length > 0 && (
            <div className="mt-3">
              <p className="sous-ligne mb-2">
                {recus.length} reçu{recus.length > 1 ? 's' : ''}
              </p>
              <div className="defile-x flex gap-2">
                {recus.map((r) => (
                  <MiniRecu key={r.id} recu={r} />
                ))}
              </div>
            </div>
          )}
        </Bloc>

        {/* --- Les ventes qu'il a alimentees ------------------------------ */}
        <Bloc
          titre="Ventes issues de cette livraison"
          apres={
            lot.ventes.length > 0 && (
              <span className="chiffres text-xs" style={{ color: 'var(--texte-doux)' }}>
                {formatHTG(lot.revenu)}
              </span>
            )
          }
        >
          {lot.ventes.length === 0 ? (
            <p className="sous-ligne">
              Aucune vente n'a encore puisé dans ce camion. L'eau la plus ancienne part
              en premier.
            </p>
          ) : (
            <ul>
              {[...lot.ventes].reverse().map((v, i) => (
                <li key={`${v.date}-${i}`}>
                  <Ligne
                    icone={Droplet}
                    couleur={couleurDonnees('#2672DD', sombre)}
                    libelle={formatDateCourte(v.date)}
                    detail={
                      // Une journee peut alimenter deux camions : sans cette
                      // mention, le montant ne correspondrait pas a la recette
                      // du jour et semblerait faux.
                      `${formatGallons(v.gallons)} à ${formatPrix(v.prix)}` +
                      (v.partielle ? ` · sur ${formatHTG(v.montantJour)} ce jour-là` : '')
                    }
                    montant={v.revenu}
                  />
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        {/* --- Les depenses de la periode --------------------------------- */}
        <Bloc
          titre="Autres dépenses pendant l'écoulement"
          apres={
            lot.autresDepenses.length > 0 && (
              <span className="chiffres text-xs" style={{ color: 'var(--texte-doux)' }}>
                {formatHTG(lot.totalAutresDepenses)}
              </span>
            )
          }
        >
          {lot.autresDepenses.length === 0 ? (
            <p className="sous-ligne">Aucune autre dépense sur cette période.</p>
          ) : (
            <ul>
              {lot.autresDepenses.map((d) => {
                const cat = etat.categories.find((c) => c.id === d.category_id)
                return (
                  <li key={d.id}>
                    <Ligne
                      icone={Package}
                      couleur={couleurDonnees(cat?.color ?? '#2672DD', sombre)}
                      libelle={d.designation || cat?.nom || 'Dépense'}
                      detail={formatDateCourte(new Date(d.occurred_at))}
                      montant={-d.total}
                      onClick={() => ouvrirFeuille('depense', d)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Bloc>

        {lot.autresDepenses.length > 0 && (
          <Pastille bloc>
            Ces dépenses ne sont pas causées par ce camion : elles sont simplement
            tombées pendant qu'il s'écoulait. Chacune n'est rattachée qu'à une seule
            livraison, donc rien n'est compté deux fois.
          </Pastille>
        )}
      </div>
    </Feuille>
  )
}

function Bloc({ titre, apres, children }) {
  return (
    <section>
      <header className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--texte-doux)' }}>
          {titre}
        </h3>
        {apres}
      </header>
      {children}
    </section>
  )
}

function Ligne({ icone: Icone, couleur, libelle, detail, montant, onClick }) {
  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      onClick={onClick}
      className={`flex w-full items-center gap-3 py-2 text-left ${
        onClick ? 'transition-opacity active:opacity-60' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-[10px]"
        style={{ background: `${couleur}22`, color: couleur }}
      >
        <Icone size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{libelle}</span>
        <span className="sous-ligne block truncate">{detail}</span>
      </span>
      <span className="chiffres shrink-0 text-sm font-medium">
        {formatHTG(montant, { signe: true })}
      </span>
      {onClick && (
        <Pencil size={13} strokeWidth={1.75} style={{ color: 'var(--texte-tres-doux)' }} />
      )}
    </Element>
  )
}

function MiniRecu({ recu }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let annule = false
    let objet = null
    lireImageRecu(recu.id, 'vignette').then((blob) => {
      if (annule || !blob) return
      objet = URL.createObjectURL(blob)
      setUrl(objet)
    })
    return () => {
      annule = true
      if (objet) URL.revokeObjectURL(objet)
    }
  }, [recu.id])

  return (
    <span
      className="block size-16 shrink-0 overflow-hidden rounded-[10px]"
      style={{ background: 'var(--surface-doux)' }}
    >
      {url && <img src={url} alt="Reçu" className="size-full object-cover" />}
    </span>
  )
}
