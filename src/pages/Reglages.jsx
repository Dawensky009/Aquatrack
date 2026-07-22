import { useRef, useState } from 'react'
import {
  Download, Upload, RotateCcw, Trash2, Plus, GripVertical,
  Coins, Truck, Gauge, Ruler, User, BellRing, Clock,
} from 'lucide-react'
import EnTete from '../components/EnTete.jsx'
import SegmentPills from '../components/SegmentPills.jsx'
import SectionSecurite from '../components/SectionSecurite.jsx'
import SectionCompte from '../components/SectionCompte.jsx'
import ListeReordonnable from '../components/ListeReordonnable.jsx'
import {
  GroupeReglage, LigneReglage, ValeurNombre, ValeurTexte, Interrupteur,
} from '../components/LigneReglage.jsx'
import { useStore, useEtat } from '../store/useStore.js'

import { supabaseConfigure } from '../lib/supabase.js'
import { formatPrix } from '../lib/format.js'
import { formatTaille } from '../lib/images.js'
import { notificationsDisponibles, demanderPermission } from '../lib/notification.js'

const PALETTE = ['#222026', '#2672DD', '#22D3F5', '#E4E4E6']

export default function Reglages() {
  const etat = useEtat()
  const majReglages = useStore((s) => s.majReglages)
  const enregistrerCategorie = useStore((s) => s.enregistrerCategorie)
  const supprimerLigne = useStore((s) => s.supprimerLigne)
  const reordonnerCategories = useStore((s) => s.reordonnerCategories)
  const reinitialiserDemo = useStore((s) => s.reinitialiserDemo)
  const viderTout = useStore((s) => s.viderTout)
  const importer = useStore((s) => s.importer)
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)
  const themeMode = useStore((s) => s.themeMode)
  const changerTheme = useStore((s) => s.changerTheme)

  const fichier = useRef(null)
  const [message, setMessage] = useState(null)

  const r = etat.reglages
  const nbRecus = etat.recus.length
  const poidsRecus = etat.recus.reduce((t, x) => t + (x.taille || 0), 0)
  const recusEnLigne = etat.recus.filter((x) => x.chemin_distant).length

  async function televerser(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return

    setMessage('Import en cours…')
    try {
      const r = await importer(f)
      const parts = []
      if (r.recettes) parts.push(`${r.recettes} journée${r.recettes > 1 ? 's' : ''}`)
      if (r.depenses) parts.push(`${r.depenses} dépense${r.depenses > 1 ? 's' : ''}`)
      if (r.recus) parts.push(`${r.recus} reçu${r.recus > 1 ? 's' : ''}`)

      let texte = parts.length ? `Importé : ${parts.join(', ')}.` : 'Rien à importer.'
      // Les lignes ecartees sont detaillees plutot que comptees : « 3 lignes
      // ignorees » n'aide pas a corriger le fichier.
      if (r.ignorees?.length) {
        texte += ` ${r.ignorees.length} ligne${r.ignorees.length > 1 ? 's' : ''} ignorée${
          r.ignorees.length > 1 ? 's' : ''
        } — ${r.ignorees.slice(0, 3).join(' ; ')}${r.ignorees.length > 3 ? ' …' : ''}`
      }
      setMessage(texte)
    } catch (err) {
      setMessage(err.message)
    }
  }

  const modeleCompteur = r.compteur_actif
    ? 'La clôture demandera le relevé et signalera tout écart entre les gallons débités et l’argent encaissé.'
    : `Sans compteur, les gallons sont déduits du montant encaissé (${formatPrix(
        r.prix_vente_gallon,
      )}/gallon) — ce n’est pas une mesure, elle ne révèle ni fuite ni manquant.`

  return (
    <>
      <EnTete titre="Réglages" avecAjout={false} />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6">
        {/* ---- Kiosque : identité et tarifs ---------------------------- */}
        <GroupeReglage
          titre="Votre kiosque"
          aide="Le prix sert à déduire les gallons vendus du montant encaissé. Le changer ne vaut que pour les journées à venir ; celles déjà clôturées gardent leur prix."
        >
          <LigneReglage
            icone={User}
            titre="Votre nom"
            trailing={
              <ValeurTexte
                valeur={r.nom_utilisateur}
                onValider={(v) => majReglages({ nom_utilisateur: v })}
                placeholder="Ex : Dawensky"
              />
            }
          />
          <LigneReglage
            icone={Coins}
            titre="Prix de vente / gallon"
            trailing={
              <ValeurNombre
                valeur={r.prix_vente_gallon}
                unite="HTG"
                onValider={(n) => majReglages({ prix_vente_gallon: n })}
              />
            }
          />
          <LigneReglage
            icone={Truck}
            titre="Capacité d'un camion"
            trailing={
              <ValeurNombre
                valeur={r.capacite_camion}
                unite="gal"
                onValider={(n) => majReglages({ capacite_camion: n })}
              />
            }
          />
        </GroupeReglage>

        {/* ---- Compteur ------------------------------------------------ */}
        <GroupeReglage titre="Compteur d'eau" aide={modeleCompteur}>
          <LigneReglage
            icone={Gauge}
            titre="J'ai un compteur d'eau"
            sousTitre="Mesure réelle des gallons débités"
            trailing={
              <Interrupteur
                actif={r.compteur_actif}
                onChange={(v) => majReglages({ compteur_actif: v })}
              />
            }
          />
          {r.compteur_actif && (
            <LigneReglage
              icone={Ruler}
              titre="Index de départ"
              sousTitre="Le relevé actuel du compteur"
              trailing={
                <ValeurNombre
                  valeur={r.compteur_index_initial}
                  unite="gal"
                  min={-1}
                  onValider={(n) => majReglages({ compteur_index_initial: n })}
                />
              }
            />
          )}
        </GroupeReglage>

        {/* ---- Categories de depenses ---------------------------------- */}
        <GroupeReglage titre="Catégories de dépenses" aide="Touchez la pastille pour changer la couleur, glissez la poignée pour l'ordre.">
          <div className="px-2 py-1">
            <ListeReordonnable items={etat.categories} onReordonner={reordonnerCategories}>
              {(c, { poignee, enDeplacement }) => (
                <LigneCategorie
                  categorie={c}
                  poignee={poignee}
                  enDeplacement={enDeplacement}
                  onEnregistrer={enregistrerCategorie}
                  onSupprimer={() => supprimerLigne('categories', c.id)}
                  supprimable={etat.categories.length > 1}
                />
              )}
            </ListeReordonnable>
          </div>
          <LigneReglage
            icone={Plus}
            titre="Ajouter une catégorie"
            onClick={() =>
              enregistrerCategorie({
                nom: 'Nouvelle catégorie',
                color: PALETTE[etat.categories.length % PALETTE.length],
                unit: 'montant',
                suit_gallons: false,
                position: etat.categories.length,
              })
            }
          />
        </GroupeReglage>

        {/* ---- Rappel de cloture --------------------------------------- */}
        <CarteRappel reglages={r} majReglages={majReglages} />

        {/* ---- Apparence ----------------------------------------------- */}
        <GroupeReglage
          titre="Apparence"
          aide="« Système » suit le réglage de votre téléphone et bascule tout seul le soir."
        >
          <div className="p-3">
            <SegmentPills
              valeur={themeMode}
              onChange={changerTheme}
              options={[
                { valeur: 'light', libelle: 'Clair' },
                { valeur: 'dark', libelle: 'Sombre' },
                { valeur: 'system', libelle: 'Système' },
              ]}
            />
          </div>
        </GroupeReglage>

        {/* ---- Compte et securite -------------------------------------- */}
        <SectionCompte />
        <SectionSecurite />

        {/* ---- Donnees ------------------------------------------------- */}
        <GroupeReglage titre="Vos données" aide={aideDonnees(supabaseConfigure, nbRecus, poidsRecus, recusEnLigne)}>
          <LigneReglage
            icone={Download}
            titre="Exporter"
            sousTitre="JSON, Excel ou CSV"
            onClick={() => ouvrirFeuille('export')}
            chevron
          />
          <LigneReglage
            icone={Upload}
            titre="Importer un fichier"
            onClick={() => fichier.current?.click()}
            chevron
          />
          <input
            ref={fichier}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={televerser}
            className="hidden"
          />
          <LigneReglage
            icone={RotateCcw}
            titre="Charger des données fictives"
            sousTitre="Pour découvrir l'application"
            onClick={async () => {
              if (
                confirm(
                  'Effacer vos données réelles et les remplacer par 60 jours de chiffres fictifs ?\n\n' +
                    'À n’utiliser que pour découvrir l’application.',
                )
              ) {
                await reinitialiserDemo()
                setMessage('Données fictives chargées. Utilisez « Repartir de zéro » pour les enlever.')
              }
            }}
          />
          <LigneReglage
            icone={Trash2}
            titre="Repartir de zéro"
            danger
            onClick={async () => {
              if (confirm('Effacer définitivement toutes vos données ? Cette action est irréversible.')) {
                await viderTout()
                setMessage('Toutes les données ont été effacées.')
              }
            }}
          />
        </GroupeReglage>

        {message && (
          <p className="px-1 text-sm" style={{ color: 'var(--texte)' }}>
            {message}
          </p>
        )}
      </div>
    </>
  )
}

/** Note de bas du groupe « Vos données » : etat de la sauvegarde et des photos. */
function aideDonnees(supabaseConfigure, nbRecus, poidsRecus, recusEnLigne) {
  const base = supabaseConfigure
    ? 'Sauvegardées sur cet appareil et synchronisées vers Supabase.'
    : 'Sauvegardées uniquement sur cet appareil. Exportez régulièrement : si vous perdez ce téléphone, elles sont perdues.'

  if (nbRecus === 0) return base

  const photos = `${nbRecus} reçu${nbRecus > 1 ? 's' : ''} · ${formatTaille(poidsRecus)}`
  const etat = !supabaseConfigure
    ? ''
    : recusEnLigne === nbRecus
      ? ' Toutes les photos sont sur le serveur.'
      : ` ${recusEnLigne}/${nbRecus} photo${nbRecus > 1 ? 's' : ''} envoyée${recusEnLigne > 1 ? 's' : ''} — le reste à la prochaine connexion.`

  return `${base} ${photos}.${etat}`
}

function LigneCategorie({
  categorie,
  onEnregistrer,
  onSupprimer,
  supprimable,
  poignee,
  enDeplacement,
}) {
  const [nom, setNom] = useState(categorie.nom)

  return (
    <div
      className="flex items-center gap-2.5 px-1 py-2.5"
      style={{ borderBottom: enDeplacement ? 'none' : '1px solid var(--bordure)' }}
    >
      {/* Cible tactile elargie : une icone de 15px se rate une fois sur deux
          au doigt, et rater la poignee fait defiler la page a la place. */}
      <span
        {...poignee}
        className="-m-2 grid size-9 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-2"
        style={{ ...poignee?.style, color: 'var(--texte-tres-doux)' }}
      >
        <GripVertical size={16} />
      </span>

      <button
        aria-label="Changer la couleur"
        onClick={() => {
          const i = PALETTE.indexOf(categorie.color)
          onEnregistrer({ ...categorie, color: PALETTE[(i + 1) % PALETTE.length] })
        }}
        className="size-4 shrink-0 rounded-full"
        style={{ background: categorie.color, outline: '1px solid rgb(0 0 0 / .08)' }}
      />

      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => nom !== categorie.nom && onEnregistrer({ ...categorie, nom })}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />

      {categorie.suit_gallons && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
          style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
        >
          suit les gallons
        </span>
      )}

      {supprimable && (
        <button
          onClick={onSupprimer}
          aria-label={`Supprimer ${categorie.nom}`}
          className="shrink-0 p-1"
          style={{ color: 'var(--texte-tres-doux)' }}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

/**
 * Rappel de cloture.
 *
 * L'interrupteur active la banniere in-app, qui ne demande rien. La notifica-
 * tion systeme est un CRAN de plus, dit comme tel : on ne demande la permission
 * qu'a l'activation, et si elle est refusee on ne ment pas — la banniere reste,
 * la notification non.
 */
function CarteRappel({ reglages, majReglages }) {
  const [permission, setPermission] = useState(
    notificationsDisponibles() ? Notification.permission : 'indisponible',
  )

  async function basculer(actif) {
    if (actif && notificationsDisponibles() && Notification.permission === 'default') {
      await demanderPermission()
      setPermission(Notification.permission)
    }
    majReglages({ rappel_actif: actif })
  }

  // La note de portee devient la note de bas de groupe : dite une fois, sous la
  // carte, plutot que serree entre les lignes.
  const aide =
    permission === 'denied'
      ? 'Les notifications sont bloquées pour ce site — autorisez-les dans votre navigateur. Le rappel s’affichera quand même à l’ouverture de l’application.'
      : permission === 'granted'
        ? 'Une notification s’affichera à l’heure dite si l’application est restée ouverte. Sinon, le rappel apparaît à la prochaine ouverture.'
        : notificationsDisponibles()
          ? 'Le rappel s’affiche à l’ouverture de l’application. Autorisez les notifications pour en être averti même sans l’ouvrir.'
          : 'Le rappel s’affiche à l’ouverture de l’application.'

  return (
    <GroupeReglage titre="Rappel de clôture" aide={reglages.rappel_actif ? aide : undefined}>
      <LigneReglage
        icone={BellRing}
        titre="Rappel de clôture"
        sousTitre="Le soir, si la journée n'est pas close"
        trailing={<Interrupteur actif={reglages.rappel_actif} onChange={basculer} />}
      />
      {reglages.rappel_actif && (
        <LigneReglage
          icone={Clock}
          titre="Heure du rappel"
          trailing={
            <input
              type="time"
              value={reglages.rappel_heure}
              onChange={(e) => majReglages({ rappel_heure: e.target.value })}
              className="chiffres rounded-[10px] px-2.5 py-1 text-sm outline-none"
              style={{ background: 'var(--surface-doux)' }}
            />
          }
        />
      )}
    </GroupeReglage>
  )
}
