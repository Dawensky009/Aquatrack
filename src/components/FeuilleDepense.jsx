import { useMemo, useState } from 'react'
import Feuille, { BoutonPrincipal } from './Feuille.jsx'
import Pastille from './Pastille.jsx'
import SegmentPills from './SegmentPills.jsx'
import { ChampMontant, ChampNombre, ChampDate, ChampTexte, Pilules } from './Champs.jsx'
import Recus from './Recus.jsx'
import BoutonSupprimer from './BoutonSupprimer.jsx'
import { enregistrerRecu, supprimerRecu } from '../lib/db.js'
import { useStore, useEtat } from '../store/useStore.js'
import * as M from '../lib/metrics.js'
import {
  cleJour, formatPrix, formatHTG, formatDateLongue, lireNombre, formatPourcent,
} from '../lib/format.js'

/**
 * Saisie d'une depense.
 *
 * Le reapprovisionnement est le cas important : c'est lui qui porte le prix
 * paye a la compagnie, donc toute la marge. Deux details comptent :
 *
 *   1. Le double mode de saisie. La compagnie annonce tantot un forfait pour
 *      le camion, tantot un tarif au gallon. On accepte les deux et on
 *      calcule l'autre — mais on stocke toujours la meme chose, si bien que
 *      l'historique des prix reste comparable quel que soit le mode utilise.
 *
 *   2. Le prix est pre-rempli avec celui du dernier reapprovisionnement.
 *      Cas courant : aucune frappe. Cas d'une hausse : un champ a corriger,
 *      et l'ecart s'affiche immediatement.
 */
/**
 * Reconcilie les recus de l'ecran avec ceux deja en base : ajoute les
 * nouveaux, supprime ceux que l'utilisateur a retires. Les inchanges ne sont
 * pas reecrits — inutile de renvoyer une image deja synchronisee.
 */
async function appliquerRecus(depenseId, aGarder, existants) {
  const gardes = new Set(aGarder.map((r) => r.id))

  for (const r of existants) {
    if (r.depense_id === depenseId && !gardes.has(r.id)) {
      await supprimerRecu(r.id)
    }
  }
  for (const r of aGarder) {
    if (r.nouveau) {
      await enregistrerRecu({
        id: r.id,
        depense_id: depenseId,
        prepare: r.prepare,
        nom: r.nom,
      })
    }
  }
}

export default function FeuilleDepense({ depense }) {
  const etat = useEtat()
  const ajouterDepense = useStore((s) => s.ajouterDepense)
  const supprimerDepense = useStore((s) => s.supprimerDepense)
  const fermerFeuille = useStore((s) => s.fermerFeuille)

  // L'identifiant est fixe des l'ouverture pour que les recus puissent s'y
  // rattacher, y compris sur une depense pas encore enregistree.
  const [id] = useState(() => depense?.id ?? crypto.randomUUID())

  // Recus deja attaches : on part des metadonnees deja en memoire, sans
  // toucher aux images tant que l'utilisateur n'en ouvre pas une.
  const [recus, setRecus] = useState(() =>
    depense ? etat.recus.filter((r) => r.depense_id === depense.id) : [],
  )
  const [enCours, setEnCours] = useState(false)

  const categories = etat.categories
  const dernierCout = M.dernierCoutGallon(etat)

  const [categorieId, setCategorieId] = useState(
    depense?.category_id ?? categories[0]?.id ?? null,
  )
  const [date, setDate] = useState(
    depense ? cleJour(new Date(depense.occurred_at)) : cleJour(),
  )

  /** Heure d'origine, en heure locale — « HH:MM:SS » pour reconstruire l'ISO. */
  const heureOrigine = useMemo(() => {
    if (!depense) return '09:00:00'
    const d = new Date(depense.occurred_at)
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':')
  }, [depense])
  const [mode, setMode] = useState(depense?.entry_mode ?? 'forfait')
  const [gallonsSaisi, setGallonsSaisi] = useState(
    String(depense?.quantity ?? etat.reglages.capacite_camion ?? ''),
  )
  const [totalSaisi, setTotalSaisi] = useState(depense ? String(depense.total) : '')
  const [prixSaisi, setPrixSaisi] = useState(
    depense?.quantity > 0
      ? String(depense.total / depense.quantity)
      : dernierCout != null
        ? String(dernierCout)
        : '',
  )
  const [paiement, setPaiement] = useState(depense?.payment_method ?? 'cash')
  const [note, setNote] = useState(depense?.note ?? '')

  /* --- Achat de materiel : article, quantite, prix unitaire --------------
     Une depense enregistree AVANT l'ajout du champ quantite n'en a pas. Elle
     doit se relire comme « 1 article a ce prix » : sans cette equivalence, le
     montant disparaitrait du formulaire a l'ouverture et le bouton resterait
     desactive — l'utilisateur ne pourrait plus corriger sa ligne. */
  const quantiteExistante = depense?.quantity > 0 ? depense.quantity : 1
  const [designation, setDesignation] = useState(depense?.designation ?? '')
  const [quantiteSaisie, setQuantiteSaisie] = useState(String(depense ? quantiteExistante : 1))
  const [prixArticleSaisi, setPrixArticleSaisi] = useState(
    depense ? String(depense.total / quantiteExistante) : '',
  )

  const categorie = categories.find((c) => c.id === categorieId)
  const estAppro = !!categorie?.suit_gallons

  const gallons = lireNombre(gallonsSaisi)
  const totalDirect = lireNombre(totalSaisi)
  const prixUnitaire = lireNombre(prixSaisi)

  const quantite = lireNombre(quantiteSaisie)
  const prixArticle = lireNombre(prixArticleSaisi)

  /* --- Le champ non saisi est calcule, dans les deux sens ---------------- */
  const { total, coutGallon } = useMemo(() => {
    if (!estAppro) {
      // Materiel : quantite × prix unitaire. Une quantite de 1 revient a
      // saisir simplement un montant, donc le cas simple reste simple.
      const t = prixArticle != null ? prixArticle * (quantite ?? 1) : null
      return { total: t, coutGallon: null }
    }
    if (mode === 'forfait') {
      const t = totalDirect
      return { total: t, coutGallon: t != null && gallons > 0 ? t / gallons : null }
    }
    const t = prixUnitaire != null && gallons != null ? prixUnitaire * gallons : null
    return { total: t, coutGallon: prixUnitaire }
  }, [estAppro, mode, totalDirect, prixUnitaire, gallons, prixArticle, quantite])

  // Comparaison avec le dernier prix paye — affichee AVANT validation.
  const variation =
    estAppro && coutGallon != null && dernierCout != null && dernierCout > 0 && !depense
      ? ((coutGallon - dernierCout) / dernierCout) * 100
      : null
  const variationNotable = variation != null && Math.abs(variation) >= 0.5

  const valide =
    categorieId != null &&
    total != null &&
    total > 0 &&
    (estAppro ? gallons != null && gallons > 0 : quantite != null && quantite > 0)

  // Comme la cloture : un bouton grise doit dire ce qui manque, jamais rester
  // muet. On pointe le premier champ vide dans l'ordre de saisie.
  let raisonInvalide = null
  if (categorieId == null) {
    raisonInvalide = 'Choisissez une catégorie.'
  } else if (estAppro && (gallons == null || gallons <= 0)) {
    raisonInvalide = 'Indiquez le nombre de gallons reçus.'
  } else if (!estAppro && (quantite == null || quantite <= 0)) {
    raisonInvalide = 'Indiquez la quantité.'
  } else if (total == null || total <= 0) {
    raisonInvalide = 'Indiquez le prix.'
  }

  async function enregistrer() {
    setEnCours(true)
    try {
      await ajouterDepense({
        id,
        // L'heure d'origine est conservee : corriger une date ne doit pas
        // deplacer silencieusement l'operation a 9h et rebattre l'ordre des
        // lignes d'une meme journee.
        occurred_at: new Date(`${date}T${heureOrigine}`).toISOString(),
        recorded_at: depense?.recorded_at,
        category_id: categorieId,
        designation: estAppro ? '' : designation.trim(),
        quantity: estAppro ? gallons : quantite,
        total,
        entry_mode: estAppro ? mode : null,
        payment_method: paiement,
        note,
      })
      // Les recus ne sont ecrits qu'ici : ajoutes plus tot, ils laisseraient
      // des images orphelines chaque fois qu'un formulaire est abandonne.
      await appliquerRecus(id, recus, depense ? etat.recus : [])
    } finally {
      setEnCours(false)
    }
    fermerFeuille()
  }

  return (
    <Feuille
      titre={depense ? 'Modifier la dépense' : 'Ajouter une dépense'}
      onFermer={fermerFeuille}
      pied={
        <div className="flex flex-col gap-2">
          {!valide && raisonInvalide && (
            <p className="text-center text-[13px]" style={{ color: 'var(--texte-doux)' }}>
              {raisonInvalide}
            </p>
          )}
          <BoutonPrincipal disabled={!valide || enCours} onClick={enregistrer}>
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </BoutonPrincipal>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Pilules
          label="Catégorie"
          valeur={categorieId}
          onChange={setCategorieId}
          options={categories.map((c) => ({ valeur: c.id, libelle: c.nom }))}
        />

        <ChampDate valeur={date} onChange={setDate} max={cleJour()} />

        {estAppro ? (
          <>
            <SegmentPills
              taille="compacte"
              valeur={mode}
              onChange={setMode}
              options={[
                { valeur: 'forfait', libelle: 'Forfait camion' },
                { valeur: 'unitaire', libelle: 'Prix au gallon' },
              ]}
            />

            <ChampNombre
              label="Gallons reçus"
              valeur={gallonsSaisi}
              onChange={setGallonsSaisi}
              unite="gallons"
              aide={`Capacité habituelle d'un camion : ${etat.reglages.capacite_camion} gallons`}
            />

            {mode === 'forfait' ? (
              <>
                <ChampMontant
                  label="Montant payé"
                  valeur={totalSaisi}
                  onChange={setTotalSaisi}
                  aide={coutGallon != null ? `Coût par gallon : ${formatPrix(coutGallon)}` : null}
                />
              </>
            ) : (
              <>
                <ChampNombre
                  label="Prix au gallon"
                  valeur={prixSaisi}
                  onChange={setPrixSaisi}
                  unite="HTG"
                />
                <ChampMontant
                  label="Total à payer"
                  valeur={total != null ? String(Math.round(total)) : ''}
                  lectureSeule
                  aide="Calculé automatiquement"
                  auto
                />
              </>
            )}

            {variationNotable && (
              <Pastille bloc>
                {variation > 0 ? '⚠ En hausse' : 'En baisse'} : {formatPrix(dernierCout)} →{' '}
                {formatPrix(coutGallon)}/gallon ({formatPourcent(variation)})
              </Pastille>
            )}
          </>
        ) : (
          <>
            <ChampTexte
              label="Article acheté"
              valeur={designation}
              onChange={setDesignation}
              placeholder="Ex : bouchons, pompe, filtre…"
            />

            <div className="grid grid-cols-2 gap-3">
              <ChampNombre label="Quantité" valeur={quantiteSaisie} onChange={setQuantiteSaisie} />
              <ChampNombre
                label="Prix unitaire"
                valeur={prixArticleSaisi}
                onChange={setPrixArticleSaisi}
                unite="HTG"
              />
            </div>

            <ChampMontant
              label="Total"
              valeur={total != null ? String(Math.round(total)) : ''}
              lectureSeule
              aide={
                quantite > 1 && prixArticle != null
                  ? `${quantite} × ${formatPrix(prixArticle)}`
                  : 'Calculé automatiquement'
              }
              auto
            />
          </>
        )}

        <div>
          <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--texte-doux)' }}>
            Mode de paiement
          </span>
          <SegmentPills
            taille="compacte"
            valeur={paiement}
            onChange={setPaiement}
            options={[
              { valeur: 'cash', libelle: 'Cash' },
              { valeur: 'moncash', libelle: 'MonCash' },
            ]}
          />
        </div>

        <Recus recus={recus} onChange={setRecus} />

        <ChampTexte
          label="Note (facultatif)"
          valeur={note}
          onChange={setNote}
          placeholder="Ex : livraison en retard"
        />

        {total != null && total > 0 && (
          <p className="sous-ligne text-center">
            Cette dépense retirera {formatHTG(total)} de votre bénéfice.
          </p>
        )}

        {depense && (
          <BoutonSupprimer
            libelle="Supprimer cette dépense"
            recapitulatif={`Supprimer « ${
              depense.designation || categories.find((c) => c.id === depense.category_id)?.nom ||
              'cette dépense'
            } » du ${formatDateLongue(depense.occurred_at.slice(0, 10))}, ${formatHTG(
              depense.total,
            )} ?`}
            onConfirmer={async () => {
              await supprimerDepense(depense.id)
              fermerFeuille()
            }}
          />
        )}
      </div>
    </Feuille>
  )
}
