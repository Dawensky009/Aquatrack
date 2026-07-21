import { useRef, useState } from 'react'
import {
  Download, Upload, RotateCcw, Trash2, Plus, GripVertical,
  Coins, Gauge, Shapes, Palette, Database,
} from 'lucide-react'
import EnTete from '../components/EnTete.jsx'
import SegmentPills from '../components/SegmentPills.jsx'
import SectionSecurite from '../components/SectionSecurite.jsx'
import SectionCompte from '../components/SectionCompte.jsx'
import ListeReordonnable from '../components/ListeReordonnable.jsx'
import EnTeteCarte from '../components/EnTeteCarte.jsx'
import { ChampReglageNombre, ChampTexte } from '../components/Champs.jsx'
import { useStore, useEtat } from '../store/useStore.js'

import { supabaseConfigure } from '../lib/supabase.js'
import { formatPrix } from '../lib/format.js'
import { formatTaille } from '../lib/images.js'

const PALETTE = ['#222026', '#2672DD', '#22D3F5', '#E4E4E6']

/**
 * Intertitre de groupe.
 *
 * Sept cartes identiques a la file, sans hierarchie, obligeaient a tout lire
 * pour trouver un reglage. Les regrouper — le kiosque, le compte, l'app —
 * donne trois reperes au lieu de sept.
 *
 * En minuscules et sans interlettrage etire : c'est un repere de navigation,
 * pas une decoration. Sur deux colonnes il occupe toute la largeur, sans quoi
 * le groupe suivant demarrerait au milieu d'une ligne.
 */
function TitreGroupe({ children }) {
  return (
    <h2
      className="mt-3 mb-0.5 px-1 text-[13px] font-medium first:mt-0 lg:col-span-2"
      style={{ color: 'var(--texte-doux)' }}
    >
      {children}
    </h2>
  )
}


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

  return (
    <>
      <EnTete titre="Réglages" avecAjout={false} />

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <TitreGroupe>Votre kiosque</TitreGroupe>

        {/* ---- Tarifs -------------------------------------------------- */}
        <section className="carte">
          <EnTeteCarte icone={Coins} titre="Tarifs" />
          <div className="mt-4 flex flex-col gap-4">
            <ChampReglageNombre
              label="Prix de vente par gallon"
              valeur={r.prix_vente_gallon}
              onValider={(n) => majReglages({ prix_vente_gallon: n })}
              unite="HTG"
              // Precision essentielle : sans elle, on croirait que changer ce
              // prix corrige aussi le passe. Elle est dite ici, sous le champ
              // concerne, plutot que dans un encart noir qui criait plus fort
              // que les champs eux-memes.
              aide="Sert à déduire les gallons vendus depuis le montant encaissé. Un changement ne vaut que pour les journées à venir : celles déjà clôturées gardent leur prix."
            />

            <ChampReglageNombre
              label="Capacité d'un camion"
              valeur={r.capacite_camion}
              onValider={(n) => majReglages({ capacite_camion: n })}
              unite="gallons"
              aide="Pré-remplit le formulaire de réapprovisionnement."
            />

            <ChampTexte
              label="Votre nom"
              valeur={r.nom_utilisateur}
              onChange={(v) => majReglages({ nom_utilisateur: v })}
              placeholder="Ex : Dawensky"
              aide="Affiché sur l'accueil, et joint à vos saisies pour l'autre personne du kiosque."
            />
          </div>
        </section>

        {/* ---- Compteur ------------------------------------------------ */}
        <section className="carte">
          <EnTeteCarte icone={Gauge} titre="Compteur d'eau" />
          <p className="sous-ligne mt-2 mb-4">
            Tant qu'il est désactivé, les gallons sont déduits du montant encaissé
            ({formatPrix(r.prix_vente_gallon)} par gallon). Cette quantité n'est donc pas
            une mesure : elle ne peut révéler ni fuite ni manquant.
          </p>

          <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
            <span className="text-sm">J'ai un compteur d'eau</span>
            <Interrupteur
              actif={r.compteur_actif}
              onChange={(v) => majReglages({ compteur_actif: v })}
            />
          </label>

          {r.compteur_actif && (
            <div className="mt-4">
              <ChampReglageNombre
                label="Index de départ du compteur"
                valeur={r.compteur_index_initial}
                onValider={(n) => majReglages({ compteur_index_initial: n })}
                unite="gallons"
                // Un compteur neuf part de zéro : c'est une valeur légitime.
                min={-1}
                aide="Le relevé actuel. Les gallons du jour seront calculés par différence."
              />
              <p className="sous-ligne mt-3">
                La clôture demandera désormais le relevé, et signalera tout écart entre les
                gallons débités et l'argent encaissé.
              </p>
            </div>
          )}
        </section>

        {/* ---- Categories de depenses ---------------------------------- */}
        <section className="carte">
          <EnTeteCarte icone={Shapes} titre="Catégories de dépenses" />
          <p className="sous-ligne mt-2 mb-3">
            Glissez la poignée pour changer l'ordre — ou sélectionnez-la et utilisez les
            flèches du clavier.
          </p>

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

          <button
            onClick={() =>
              enregistrerCategorie({
                nom: 'Nouvelle catégorie',
                color: PALETTE[etat.categories.length % PALETTE.length],
                unit: 'montant',
                suit_gallons: false,
                position: etat.categories.length,
              })
            }
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm"
            style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
          >
            <Plus size={16} /> Ajouter une catégorie
          </button>
        </section>

        <TitreGroupe>Compte et sécurité</TitreGroupe>

        <SectionCompte />

        <SectionSecurite />

        <TitreGroupe>Application</TitreGroupe>

        {/* ---- Apparence ----------------------------------------------- */}
        <section className="carte">
          <EnTeteCarte icone={Palette} titre="Apparence" />
          <p className="sous-ligne mt-2 mb-4">
            « Système » suit le réglage de votre téléphone et bascule tout seul le soir.
          </p>
          <SegmentPills
            valeur={themeMode}
            onChange={changerTheme}
            options={[
              { valeur: 'light', libelle: 'Clair' },
              { valeur: 'dark', libelle: 'Sombre' },
              { valeur: 'system', libelle: 'Système' },
            ]}
          />
        </section>

        {/* ---- Donnees ------------------------------------------------- */}
        <section className="carte">
          <EnTeteCarte icone={Database} titre="Vos données" />
          <p className="sous-ligne mt-2 mb-4">
            {supabaseConfigure
              ? 'Sauvegardées sur cet appareil et synchronisées vers Supabase.'
              : "Sauvegardées uniquement sur cet appareil. Exportez régulièrement : si vous perdez ce téléphone, elles sont perdues."}
          </p>

          {nbRecus > 0 && (
            <p className="sous-ligne mb-3">
              {nbRecus} reçu{nbRecus > 1 ? 's' : ''} photographié{nbRecus > 1 ? 's' : ''} ·{' '}
              {formatTaille(poidsRecus)}. Ils sont inclus dans la sauvegarde.
              {/* Les photos ne partent PAS avec les chiffres : elles suivent
                  leur propre file, cinq par cycle. Dire où elles en sont evite
                  de croire tout sauvegarde alors que les images sont encore
                  sur le telephone. */}
              {supabaseConfigure &&
                (recusEnLigne === nbRecus
                  ? ' Toutes les photos sont sur le serveur.'
                  : ` ${recusEnLigne} photo${recusEnLigne > 1 ? 's' : ''} envoyée${
                      recusEnLigne > 1 ? 's' : ''
                    } sur ${nbRecus} — les autres partiront à la prochaine connexion.`)}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <BoutonReglage icone={Download} onClick={() => ouvrirFeuille('export')}>
              Exporter — JSON, Excel ou CSV
            </BoutonReglage>
            <BoutonReglage icone={Upload} onClick={() => fichier.current?.click()}>
              Importer un fichier
            </BoutonReglage>
            <input
              ref={fichier}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={televerser}
              className="hidden"
            />
            {/* Ce bouton EFFACE tout et le remplace par 60 jours fictifs. Son
                ancien libellé (« Réinitialiser la démonstration ») laissait
                croire à une remise à zéro anodine : il fallait dire ce qu'il
                détruit, et le mot « fictives » doit apparaître. */}
            <BoutonReglage
              icone={RotateCcw}
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
            >
              Charger des données fictives (démo)
            </BoutonReglage>
            <BoutonReglage
              icone={Trash2}
              onClick={async () => {
                if (confirm('Effacer définitivement toutes vos données ? Cette action est irréversible.')) {
                  await viderTout()
                  setMessage('Toutes les données ont été effacées.')
                }
              }}
            >
              Repartir de zéro
            </BoutonReglage>
          </div>

          {message && (
            <p className="sous-ligne mt-4" style={{ color: 'var(--texte)' }}>
              {message}
            </p>
          )}
        </section>
      </div>
    </>
  )
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

function BoutonReglage({ icone: Icone, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left text-sm transition-transform active:scale-[0.99]"
      style={{ background: 'var(--surface-doux)' }}
    >
      <Icone size={17} strokeWidth={1.75} style={{ color: 'var(--texte-doux)' }} />
      {children}
    </button>
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
