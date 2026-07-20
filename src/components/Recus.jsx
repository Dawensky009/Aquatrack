import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, X, Loader2 } from 'lucide-react'
import { preparerRecu, formatTaille, ErreurImage } from '../lib/images.js'
import { lireImageRecu } from '../lib/db.js'
import Pastille from './Pastille.jsx'

/**
 * Pieces jointes d'une depense — photos de recus.
 *
 * Les recus vivent dans l'etat du composant jusqu'a l'enregistrement de la
 * depense, jamais avant. Persister a l'ajout laisserait des images orphelines
 * en base chaque fois qu'un formulaire est abandonne.
 *
 * Deux boutons distincts : « Photographier » ouvre directement l'appareil
 * photo (`capture="environment"`), « Choisir » la galerie. Sur un kiosque, on
 * photographie le ticket au moment de payer — un seul geste.
 */
/**
 * Vrai si l'appareil a une camera utilisable depuis un champ de fichier.
 * `pointer: coarse` distingue le tactile de la souris — c'est le signal le
 * plus fiable, la detection par user-agent etant contournable et fragile.
 */
const aUnAppareilPhoto =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export default function Recus({ recus, onChange }) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [apercu, setApercu] = useState(null)

  const appareil = useRef(null)
  const galerie = useRef(null)

  async function ajouter(evenement) {
    const fichiers = [...(evenement.target.files ?? [])]
    evenement.target.value = ''
    if (!fichiers.length) return

    setOccupe(true)
    setErreur(null)
    const nouveaux = []
    for (const f of fichiers) {
      try {
        const prepare = await preparerRecu(f)
        nouveaux.push({
          id: crypto.randomUUID(),
          nom: f.name,
          prepare,
          url: URL.createObjectURL(prepare.vignette),
          nouveau: true,
        })
      } catch (e) {
        setErreur(e instanceof ErreurImage ? e.message : "Cette image n'a pas pu être traitée.")
      }
    }
    if (nouveaux.length) onChange([...recus, ...nouveaux])
    setOccupe(false)
  }

  function retirer(id) {
    const r = recus.find((x) => x.id === id)
    if (r?.nouveau && r.url) URL.revokeObjectURL(r.url)
    onChange(recus.filter((x) => x.id !== id))
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px]" style={{ color: 'var(--texte-doux)' }}>
          Reçus
        </span>
        {recus.length > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--texte-tres-doux)' }}>
            {recus.length} photo{recus.length > 1 ? 's' : ''} ·{' '}
            {formatTaille(recus.reduce((t, r) => t + (r.prepare?.taille ?? r.taille ?? 0), 0))}
          </span>
        )}
      </div>

      {recus.length > 0 && (
        <ul className="defile-x mb-2 flex gap-2 pb-1">
          {recus.map((r) => (
            <li key={r.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setApercu(r)}
                className="block size-20 overflow-hidden rounded-[12px]"
                style={{ background: 'var(--surface-doux)' }}
              >
                <Vignette recu={r} />
              </button>
              <button
                type="button"
                onClick={() => retirer(r.id)}
                aria-label="Retirer ce reçu"
                className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full"
                style={{
                  background: 'var(--action)',
                  color: 'var(--sur-action)',
                  boxShadow: 'var(--ombre-flottant)',
                }}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Sur ordinateur, l'attribut `capture` est ignore : les deux boutons
          ouvriraient le meme selecteur de fichiers. Afficher « Photographier »
          la ou il n'y a pas d'appareil photo serait mensonger — on n'en montre
          alors qu'un seul. */}
      <div className="flex gap-2">
        {aUnAppareilPhoto && (
          <BoutonAjout
            icone={occupe ? Loader2 : Camera}
            libelle={occupe ? 'Traitement…' : 'Photographier'}
            onClick={() => appareil.current?.click()}
            occupe={occupe}
          />
        )}
        <BoutonAjout
          icone={occupe && !aUnAppareilPhoto ? Loader2 : ImagePlus}
          libelle={
            occupe && !aUnAppareilPhoto
              ? 'Traitement…'
              : aUnAppareilPhoto
                ? 'Choisir'
                : 'Ajouter une photo'
          }
          onClick={() => galerie.current?.click()}
          occupe={occupe}
        />
      </div>

      {/* `capture` demande l'appareil photo arriere. Ignore sur ordinateur,
          ou le champ se comporte comme un selecteur de fichier ordinaire. */}
      <input
        ref={appareil}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={ajouter}
        className="hidden"
      />
      <input
        ref={galerie}
        type="file"
        accept="image/*"
        multiple
        onChange={ajouter}
        className="hidden"
      />

      {erreur && (
        <div className="mt-2">
          <Pastille bloc>{erreur}</Pastille>
        </div>
      )}

      {apercu && <Visionneuse recu={apercu} onFermer={() => setApercu(null)} />}
    </div>
  )
}

function BoutonAjout({ icone: Icone, libelle, onClick, occupe }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={occupe}
      className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-2.5 text-[13px] transition-transform active:scale-[0.99] disabled:opacity-50"
      style={{ background: 'var(--surface-doux)', color: 'var(--texte-doux)' }}
    >
      <Icone size={16} strokeWidth={1.75} className={occupe ? 'animate-spin' : ''} />
      {libelle}
    </button>
  )
}

/**
 * Vignette. Les recus deja enregistres n'ont pas d'URL en memoire : on la
 * fabrique a la demande depuis IndexedDB, et on la revoque au demontage pour
 * ne pas fuir de memoire au fil des ouvertures de formulaire.
 */
function Vignette({ recu }) {
  const [url, setUrl] = useState(recu.url ?? null)

  useEffect(() => {
    if (recu.url) return
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
  }, [recu.id, recu.url])

  if (!url) return <span className="block size-full" />
  return <img src={url} alt="" className="size-full object-cover" />
}

/** Affichage plein ecran, pour relire un montant sur le ticket. */
function Visionneuse({ recu, onFermer }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let annule = false
    let objet = null
    const source = recu.prepare?.blob
      ? Promise.resolve(recu.prepare.blob)
      : lireImageRecu(recu.id, 'image')
    source.then((blob) => {
      if (annule || !blob) return
      objet = URL.createObjectURL(blob)
      setUrl(objet)
    })
    const auClavier = (e) => e.key === 'Escape' && onFermer()
    document.addEventListener('keydown', auClavier)
    return () => {
      annule = true
      if (objet) URL.revokeObjectURL(objet)
      document.removeEventListener('keydown', auClavier)
    }
  }, [recu, onFermer])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgb(0 0 0 / .88)' }}
      onClick={onFermer}
      role="dialog"
      aria-label="Reçu"
    >
      <button
        onClick={onFermer}
        aria-label="Fermer"
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full"
        style={{ background: 'rgb(255 255 255 / .14)', color: '#FFFFFF' }}
      >
        <X size={20} strokeWidth={2} />
      </button>
      {url && (
        <img
          src={url}
          alt="Reçu"
          className="max-h-full max-w-full rounded-[12px] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  )
}
