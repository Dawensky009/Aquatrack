import { useMemo, useState } from 'react'
import Feuille, { BoutonPrincipal } from './Feuille.jsx'
import Pastille from './Pastille.jsx'
import { ChampMontant, ChampNombre, ChampDate } from './Champs.jsx'
import { useStore, useEtat } from '../store/useStore.js'
import * as M from '../lib/metrics.js'
import { cleJour, formatHTG, formatPrix, formatGallons, lireNombre } from '../lib/format.js'

/**
 * Cloture d'une journee — l'action quotidienne de l'application.
 *
 * Elle doit se faire en quelques secondes : un montant, et c'est plie. Tout
 * le reste est calcule et montre AVANT validation, pour que l'utilisateur
 * puisse verifier son chiffre plutot que de decouvrir le resultat apres coup.
 *
 * Deux modes, selon que le compteur physique est installe ou non :
 *
 *   - estime   : les gallons se deduisent du montant (montant / prix). Ils
 *                ne constituent PAS une mesure independante et ne peuvent
 *                donc reveler ni fuite ni manquant.
 *   - compteur : les gallons sont releves. L'ecart entre ce que le compteur
 *                a debite et ce que la caisse a encaisse devient alors une
 *                information reelle — c'est tout l'interet du compteur.
 */
export default function FeuilleCloture({ dateInitiale }) {
  const etat = useEtat()
  const cloturerJour = useStore((s) => s.cloturerJour)
  const fermerFeuille = useStore((s) => s.fermerFeuille)

  const prix = etat.reglages.prix_vente_gallon
  const compteurActif = etat.reglages.compteur_actif

  const [date, setDate] = useState(dateInitiale ?? cleJour())
  const [montantSaisi, setMontantSaisi] = useState('')
  const [moncashSaisi, setMoncashSaisi] = useState('')
  const [releveSaisi, setReleveSaisi] = useState('')
  const [compteurRemisAZero, setCompteurRemisAZero] = useState(false)

  // Une journee deja cloturee se modifie, elle ne se duplique jamais.
  const existante = useMemo(
    () => etat.journees.find((j) => j.date === date),
    [etat.journees, date],
  )

  // Dernier relevé connu, pour calculer les gallons du jour par difference.
  const releveePrecedent = useMemo(() => {
    const avec = etat.journees
      .filter((j) => j.releve_compteur != null && j.date < date)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (avec.length) return avec[avec.length - 1].releve_compteur
    return etat.reglages.compteur_index_initial
  }, [etat.journees, etat.reglages.compteur_index_initial, date])

  const montant = lireNombre(montantSaisi)
  const moncash = lireNombre(moncashSaisi) ?? 0
  const releve = lireNombre(releveSaisi)

  /* --- Calcul des gallons ------------------------------------------------ */

  let gallons = null
  let source = 'estime'
  let erreurReleve = null

  if (compteurActif && releve != null) {
    source = 'compteur'
    if (compteurRemisAZero || releveePrecedent == null) {
      gallons = releve
    } else if (releve < releveePrecedent) {
      erreurReleve =
        "Ce relevé est inférieur au précédent. Un compteur ne recule pas — cochez la case ci-dessous s'il a été remplacé."
    } else {
      gallons = releve - releveePrecedent
    }
  } else if (montant != null && prix > 0) {
    gallons = montant / prix
  }

  /* --- Indicateurs affiches en direct ------------------------------------ */

  const coutGallon = M.dernierCoutGallon(etat)
  const beneficeJour =
    montant != null && gallons != null && coutGallon != null ? montant - gallons * coutGallon : null

  const prixMoyenReel = gallons > 0 && montant != null ? montant / gallons : null
  const ecart =
    source === 'compteur' && gallons != null && montant != null ? montant - gallons * prix : null
  // On ne signale que les manquants notables : quelques gourdes d'arrondi ne
  // valent pas une alerte quotidienne.
  const ecartNotable = ecart != null && Math.abs(ecart) >= prix

  const valide =
    montant != null && montant >= 0 && gallons != null && gallons >= 0 && !erreurReleve && moncash <= montant

  async function enregistrer() {
    await cloturerJour({
      date,
      montant,
      moncash,
      gallons,
      gallons_source: source,
      releve_compteur: source === 'compteur' ? releve : null,
      prix_reference: prix,
      note: '',
    })
    fermerFeuille()
  }

  return (
    <Feuille
      titre={existante ? 'Modifier la journée' : 'Clôturer la journée'}
      onFermer={fermerFeuille}
      pied={
        <BoutonPrincipal disabled={!valide} onClick={enregistrer}>
          {existante ? 'Enregistrer les modifications' : 'Clôturer la journée'}
        </BoutonPrincipal>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <ChampDate valeur={date} onChange={setDate} max={cleJour()} />

        {existante && (
          <Pastille bloc>
            Cette journée est déjà clôturée à {formatHTG(existante.montant)}. Enregistrer la
            remplacera.
          </Pastille>
        )}

        {compteurActif && (
          <>
            <ChampNombre
              label="Relevé du compteur"
              valeur={releveSaisi}
              onChange={setReleveSaisi}
              unite="gallons"
              aide={
                releveePrecedent != null
                  ? `Relevé précédent : ${formatGallons(releveePrecedent)}`
                  : 'Premier relevé — il servira de point de départ.'
              }
            />
            {erreurReleve && <Pastille bloc>{erreurReleve}</Pastille>}
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--texte-doux)' }}>
              <input
                type="checkbox"
                checked={compteurRemisAZero}
                onChange={(e) => setCompteurRemisAZero(e.target.checked)}
              />
              Le compteur a été remplacé ou remis à zéro
            </label>
          </>
        )}

        <ChampMontant
          label="Montant encaissé"
          valeur={montantSaisi}
          onChange={setMontantSaisi}
          autoFocus
          aide={
            gallons != null && montant != null
              ? `${formatGallons(gallons)} · ${formatPrix(prix)}/gallon`
              : `Les gallons seront déduits au prix de ${formatPrix(prix)}`
          }
          auto
        />

        {/* Le benefice du jour, avant validation. C'est le chiffre qui donne
            envie d'ouvrir l'app le lendemain. */}
        {beneficeJour != null && (
          <div
            className="flex items-baseline justify-between rounded-[16px] px-4 py-3"
            style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
          >
            <span className="text-[13px]" style={{ color: 'var(--sur-hero-doux)' }}>
              Bénéfice du jour
            </span>
            <span className="chiffres text-lg font-medium">{formatHTG(beneficeJour)}</span>
          </div>
        )}

        {ecartNotable && (
          <Pastille bloc>
            {ecart < 0
              ? `⚠ ${formatGallons(gallons)} débités pour ${formatHTG(montant)} — il manque ${formatHTG(Math.abs(ecart))}`
              : `${formatGallons(gallons)} débités pour ${formatHTG(montant)} — ${formatHTG(ecart)} de plus qu'attendu`}
            {prixMoyenReel != null && ` (${formatPrix(prixMoyenReel)}/gallon réel)`}
          </Pastille>
        )}

        <ChampNombre
          label="dont MonCash"
          valeur={moncashSaisi}
          onChange={setMoncashSaisi}
          unite="HTG"
          aide={
            moncash > (montant ?? 0)
              ? 'La part MonCash ne peut pas dépasser le montant encaissé.'
              : 'Laissez à zéro si tout a été encaissé en liquide.'
          }
        />
      </div>
    </Feuille>
  )
}
