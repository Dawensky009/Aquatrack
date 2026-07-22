import { useMemo, useState } from 'react'
import { ScrollText, Search, X } from 'lucide-react'
import EnTete from '../components/EnTete.jsx'
import SegmentPills from '../components/SegmentPills.jsx'
import EtatVide from '../components/EtatVide.jsx'
import LigneJournal, { versLigne } from '../components/LigneJournal.jsx'
import VueCalendrier from '../components/VueCalendrier.jsx'
import SelecteurMois from '../components/SelecteurMois.jsx'
import { useStore, useEtat } from '../store/useStore.js'
import { formatHTG, cleJour, normaliser } from '../lib/format.js'

/**
 * Journal des operations.
 *
 * Deux vues qui ne repondent pas a la meme question :
 *
 *   - LISTE : « qu'est-ce que j'ai fait ? » — le detail chronologique, avec
 *     le montant et la categorie de chaque ligne.
 *   - CALENDRIER : « qu'est-ce qui manque ? » — une journee oubliee disparait
 *     d'une liste, mais saute aux yeux dans une grille.
 *
 * Les deux partagent le mois consulte, pour qu'on puisse basculer de l'une a
 * l'autre sans se reperdre.
 */
const VUES = [
  { valeur: 'liste', libelle: 'Liste' },
  { valeur: 'calendrier', libelle: 'Calendrier' },
]

const FILTRES = [
  { valeur: 'tout', libelle: 'Tout' },
  { valeur: 'revenu', libelle: 'Revenus' },
  { valeur: 'depense', libelle: 'Dépenses' },
]

export default function Journal() {
  const etat = useEtat()
  const ouvrirFeuille = useStore((s) => s.ouvrirFeuille)

  const [vue, setVue] = useState('liste')
  const [filtre, setFiltre] = useState('tout')
  const [recherche, setRecherche] = useState('')
  const maintenant = new Date()
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [mois, setMois] = useState(maintenant.getMonth())

  const requete = normaliser(recherche.trim())
  const enRecherche = requete.length > 0

  const d = useMemo(
    () => (enRecherche ? chercherPartout(etat, requete, filtre) : filtrerMois(etat, annee, mois, filtre)),
    [etat, annee, mois, filtre, requete, enRecherche],
  )
  const annees = useMemo(() => anneesAvecDonnees(etat), [etat])

  // La recherche parcourt tout l'historique : le calendrier, lui, n'a de sens
  // que sur un mois donne. On bascule donc en liste tant qu'on cherche.
  const vueEffective = enRecherche ? 'liste' : vue

  return (
    <>
      <EnTete titre="Journal" />

      <ChampRecherche valeur={recherche} onChange={setRecherche} />

      {/* Vue et mois n'ont plus cours pendant une recherche : elle traverse
          tous les mois. On les retire plutot que de les laisser inertes. */}
      {!enRecherche && (
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <SegmentPills options={VUES} valeur={vue} onChange={setVue} className="lg:w-64" />
          <div className="lg:w-72">
            <SelecteurMois
              annee={annee}
              mois={mois}
              onChange={(a, m) => {
                setAnnee(a)
                setMois(m)
              }}
              anneesDisponibles={annees}
            />
          </div>
        </div>
      )}

      {/* Synthese : le mois consulte, ou le total des resultats en recherche.
          Sans elle, changer de mois — ou lancer une recherche — ne dirait rien
          tant qu'on n'a pas parcouru toute la liste. */}
      <section className="carte mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
            {enRecherche ? 'Net des résultats' : 'Net du mois'}
          </span>
          <span className="chiffre-stat">{formatHTG(d.net)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="sous-ligne">
            {formatHTG(d.revenus)} encaissés · {formatHTG(d.totalDepenses)} dépensés
          </span>
          <span className="sous-ligne">
            {enRecherche
              ? `${d.lignes.length} résultat${d.lignes.length > 1 ? 's' : ''}`
              : `${d.nbCloturees} jour${d.nbCloturees > 1 ? 's' : ''} clôturé${d.nbCloturees > 1 ? 's' : ''}`}
          </span>
        </div>
      </section>

      {vueEffective === 'calendrier' ? (
        <section className="carte">
          <VueCalendrier
            journees={d.journees}
            categories={etat.categories}
            depenses={d.depenses}
            annee={annee}
            mois={mois}
            onJour={(c) => ouvrirFeuille('cloture', { date: c.date })}
          />
        </section>
      ) : (
        <>
          <SegmentPills
            options={FILTRES}
            valeur={filtre}
            onChange={setFiltre}
            taille="compacte"
            className="mb-3"
          />

          {d.lignes.length === 0 ? (
            <div className="carte">
              <EtatVide
                icone={enRecherche ? Search : ScrollText}
                titre={enRecherche ? 'Aucun résultat' : 'Aucune opération ce mois-ci'}
                texte={
                  enRecherche
                    ? `Rien ne correspond à « ${recherche.trim()} ». Essayez un nom d'article, une catégorie ou un montant.`
                    : 'Changez de mois, ou clôturez une journée pour commencer.'
                }
              />
            </div>
          ) : (
            <section className="carte">
              <ul>
                {d.lignes.map((l) => (
                  <li key={l.cle}>
                    <LigneJournal
                      ligne={l}
                      onClick={() =>
                        l.type === 'revenu'
                          ? ouvrirFeuille('cloture', { date: l.source.date })
                          : l.suitGallons
                            ? ouvrirFeuille('lot', { id: l.source.id })
                            : ouvrirFeuille('depense', l.source)
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}

/**
 * Champ de recherche.
 *
 * Une croix apparait des qu'on a tape : effacer une recherche au doigt, lettre
 * par lettre, est penible — un seul appui doit suffire a revenir a la liste.
 */
function ChampRecherche({ valeur, onChange }) {
  return (
    <div className="relative mb-3">
      <Search
        size={17}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
        style={{ color: 'var(--texte-doux)' }}
      />
      <input
        type="search"
        inputMode="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un article, une catégorie, un montant…"
        aria-label="Rechercher dans le journal"
        className="w-full rounded-[16px] py-3 pr-11 pl-11 text-sm outline-none"
        style={{ background: 'var(--surface-doux)' }}
      />
      {valeur && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 place-items-center rounded-full"
          style={{ color: 'var(--texte-doux)' }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

/**
 * Recherche a travers TOUT l'historique, tous mois confondus.
 *
 * Retrouver « les bouchons » ne doit pas obliger a se souvenir du mois de
 * l'achat : c'est justement quand on ne sait plus quand qu'on cherche. Le
 * filtre de type (revenus / depenses) reste applique, lui.
 */
function chercherPartout(etat, requete, filtre) {
  const lignes = [
    ...(filtre !== 'depense' ? etat.journees.map((j) => versLigne(j, etat)) : []),
    ...(filtre !== 'revenu' ? etat.depenses.map((x) => versLigne(x, etat)) : []),
  ]
    .filter((l) => l.recherche.includes(requete))
    .sort((a, b) => b.tri.localeCompare(a.tri))

  const revenus = lignes.filter((l) => l.type === 'revenu').reduce((t, l) => t + l.montant, 0)
  const totalDepenses = lignes.filter((l) => l.type === 'depense').reduce((t, l) => t + l.montant, 0)

  return { lignes, revenus, totalDepenses, net: revenus - totalDepenses }
}

function filtrerMois(etat, annee, mois, filtre) {
  const debut = cleJour(new Date(annee, mois, 1))
  const fin = cleJour(new Date(annee, mois + 1, 0))
  const dans = (cle) => cle >= debut && cle <= fin

  const journees = etat.journees.filter((j) => dans(j.date))
  const depenses = etat.depenses.filter((x) => dans(cleJour(new Date(x.occurred_at))))

  const revenus = journees.reduce((t, j) => t + j.montant, 0)
  const totalDepenses = depenses.reduce((t, x) => t + x.total, 0)

  const lignes = [
    ...(filtre !== 'depense' ? journees.map((j) => versLigne(j, etat)) : []),
    ...(filtre !== 'revenu' ? depenses.map((x) => versLigne(x, etat)) : []),
  ].sort((a, b) => b.tri.localeCompare(a.tri))

  return {
    journees,
    depenses,
    lignes,
    revenus,
    totalDepenses,
    net: revenus - totalDepenses,
    nbCloturees: journees.length,
  }
}

/** Annees pour lesquelles il existe au moins une operation. */
function anneesAvecDonnees(etat) {
  const s = new Set()
  for (const j of etat.journees) s.add(Number(j.date.slice(0, 4)))
  for (const x of etat.depenses) s.add(new Date(x.occurred_at).getFullYear())
  return [...s]
}
