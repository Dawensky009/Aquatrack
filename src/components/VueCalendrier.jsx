import { useMemo } from 'react'
import { Truck, Package, Gauge } from 'lucide-react'
import { formatHTG, cleJour, depuisCleJour } from '../lib/format.js'

/**
 * Vue mensuelle du journal.
 *
 * Ce que la liste ne montre pas : les TROUS. Une journee oubliee disparait
 * simplement d'une liste chronologique, alors qu'elle saute aux yeux dans une
 * grille — c'est la case vide au milieu des autres. Sur une application dont
 * la donnee depend entierement d'une saisie quotidienne, c'est la vue la plus
 * utile pour reperer ce qui manque.
 *
 * Chaque case porte la recette du jour et une barre dont le remplissage est
 * relatif au meilleur jour du mois : on lit le rythme sans avoir a comparer
 * des chiffres un a un.
 */
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function VueCalendrier({ journees, depenses, categories, annee, mois, onJour }) {
  const cases = useMemo(
    () => construireGrille(journees, depenses, categories, annee, mois),
    [journees, depenses, categories, annee, mois],
  )

  const max = Math.max(...cases.filter(Boolean).map((c) => c.revenus), 1)
  const aujourdhui = cleJour()

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {JOURS.map((j) => (
          <div key={j} className="text-center text-[10px]" style={{ color: 'var(--texte-doux)' }}>
            {j}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cases.map((c, i) =>
          c === null ? (
            <div key={`vide-${i}`} />
          ) : (
            <Case
              key={c.date}
              donnees={c}
              max={max}
              estAujourdhui={c.date === aujourdhui}
              futur={c.date > aujourdhui}
              onClick={() => onJour(c)}
            />
          ),
        )}
      </div>

      <Legende />
    </div>
  )
}

function Case({ donnees, max, estAujourdhui, futur, onClick }) {
  const { jour, revenus, cloturee, marqueurs } = donnees
  const remplissage = revenus > 0 ? Math.max(8, (revenus / max) * 100) : 0

  // Un jour a venir n'est pas « oublie » : il est simplement devant nous, et
  // AUJOURD'HUI non plus — la journee n'est pas finie, on cloture le soir.
  // Les confondre avec un trou de saisie transformerait la fin de chaque mois
  // en un mur d'alertes injustifiees.
  const manquante = !cloturee && !futur && !estAujourdhui

  return (
    <button
      onClick={onClick}
      // Carree sur telephone, ou la largeur de colonne est deja petite ; plus
      // basse sur grand ecran, sinon une colonne de 160px donnerait des cases
      // de 160px de haut, vides aux trois quarts.
      className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-[10px] p-1.5 text-left transition-transform active:scale-95 md:aspect-[4/3] lg:aspect-[2/1]"
      style={{
        background: cloturee ? 'var(--surface-doux)' : 'transparent',
        border: manquante
          ? '1px dashed var(--bordure)'
          : estAujourdhui
            ? '1.5px solid var(--accent)'
            : '1px solid transparent',
        opacity: futur ? 0.4 : 1,
      }}
    >
      <span className="flex items-start justify-between gap-0.5">
        <span
          className="chiffres text-[11px] leading-none"
          style={{
            color: estAujourdhui ? 'var(--accent)' : 'var(--texte-doux)',
            fontWeight: estAujourdhui ? 600 : 400,
          }}
        >
          {jour}
        </span>

        {/* Deux marqueurs au maximum : au-dela, une case de 45px devient
            illisible et le calendrier perd son interet de coup d'oeil. */}
        <span className="flex shrink-0 gap-0.5">
          {marqueurs.slice(0, 2).map((m) => (
            <span
              key={m.cle}
              title={m.titre}
              className="grid size-[15px] place-items-center rounded-full"
              style={{ background: `${m.couleur}26`, color: m.couleur }}
            >
              <m.icone size={9} strokeWidth={2.5} />
            </span>
          ))}
        </span>
      </span>

      {cloturee && (
        <span className="w-full">
          <span
            className="chiffres block truncate text-[9px] leading-tight"
            style={{ color: 'var(--texte)' }}
          >
            {Math.round(revenus / 1000) >= 1
              ? `${(revenus / 1000).toFixed(1).replace('.', ',')}k`
              : revenus}
          </span>
          <span
            className="mt-0.5 block h-1 rounded-full"
            style={{ width: `${remplissage}%`, background: 'var(--accent)' }}
          />
        </span>
      )}
    </button>
  )
}

function Legende() {
  return (
    <ul
      className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]"
      style={{ color: 'var(--texte-doux)' }}
    >
      <li className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-[4px]"
          style={{ background: 'var(--surface-doux)' }}
          aria-hidden="true"
        />
        Journée clôturée
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-[4px]"
          style={{ border: '1px dashed var(--bordure)' }}
          aria-hidden="true"
        />
        Non clôturée
      </li>
      <PastilleLegende icone={Truck} couleur="#2672DD" libelle="Livraison" />
      <PastilleLegende icone={Package} couleur="#22D3F5" libelle="Achat" />
      <PastilleLegende icone={Gauge} couleur="#22D3F5" libelle="Compteur" />
    </ul>
  )
}

function PastilleLegende({ icone: Icone, couleur, libelle }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="grid size-[15px] place-items-center rounded-full"
        style={{ background: `${couleur}26`, color: couleur }}
      >
        <Icone size={9} strokeWidth={2.5} />
      </span>
      {libelle}
    </li>
  )
}

/**
 * Construit la grille du mois, lundi en premier.
 *
 * Les cases `null` en tete comblent les jours de la semaine precedente : sans
 * elles, le 1er du mois se placerait toujours sous « Lun » quel que soit le
 * jour reel, et toute la grille mentirait.
 */
function construireGrille(journees, depenses, categories = [], annee, mois) {
  const premier = new Date(annee, mois, 1)
  const nbJours = new Date(annee, mois + 1, 0).getDate()
  const decalage = (premier.getDay() + 6) % 7 // lundi = 0

  const parDate = new Map(journees.map((j) => [j.date, j]))

  // Les depenses sont regroupees par jour, avec la nature de leur categorie :
  // une livraison de camion et un achat de bouchons ne meritent pas le meme
  // signe sur le calendrier.
  const depParJour = new Map()
  for (const d of depenses) {
    const cle = cleJour(new Date(d.occurred_at))
    const cat = categories.find((c) => c.id === d.category_id)
    if (!depParJour.has(cle)) depParJour.set(cle, [])
    depParJour.get(cle).push({ appro: !!cat?.suit_gallons, nom: cat?.nom ?? 'Dépense' })
  }

  const cases = Array.from({ length: decalage }, () => null)
  for (let n = 1; n <= nbJours; n++) {
    const date = cleJour(new Date(annee, mois, n))
    const j = parDate.get(date)
    const ds = depParJour.get(date) ?? []

    // Ordre d'importance : une livraison prime sur un achat courant, qui prime
    // sur la mention du compteur. C'est ce qui decide de ce qu'on garde quand
    // la place manque.
    const marqueurs = []
    if (ds.some((d) => d.appro)) {
      marqueurs.push({ cle: 'appro', icone: Truck, couleur: '#2672DD', titre: "Livraison d'eau" })
    }
    if (ds.some((d) => !d.appro)) {
      marqueurs.push({ cle: 'achat', icone: Package, couleur: '#22D3F5', titre: 'Achat' })
    }
    if (j?.gallons_source === 'compteur') {
      marqueurs.push({ cle: 'compteur', icone: Gauge, couleur: '#22D3F5', titre: 'Relevé compteur' })
    }

    cases.push({
      date,
      jour: n,
      revenus: j?.montant ?? 0,
      gallons: j?.gallons ?? 0,
      cloturee: !!j,
      marqueurs,
      journee: j ?? null,
    })
  }
  return cases
}

export { depuisCleJour }
