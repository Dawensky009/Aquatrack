import { useCallback, useRef, useState } from 'react'

/**
 * Liste reordonnable par glisser-deposer.
 *
 * Construite sur les POINTER EVENTS, et non sur l'API drag-and-drop du HTML :
 * cette derniere ne se declenche tout simplement pas au doigt sur mobile, ce
 * qui aurait donne une poignee decorative sur l'appareil ou l'application est
 * principalement utilisee.
 *
 * Le clavier fait le meme travail : flechir haut/bas sur la poignee deplace la
 * ligne. C'est indispensable a l'accessibilite, et bien plus rapide qu'un
 * glisser a la souris quand on reorganise plusieurs lignes d'affilee.
 */
export default function ListeReordonnable({ items, onReordonner, cle = (i) => i.id, children }) {
  const conteneur = useRef(null)
  const mesures = useRef([])
  const [traine, setTraine] = useState(null) // { index, cible, dy }

  // Copie synchrone de l'etat de glissement. Indispensable : declencher le
  // reordonnancement depuis l'interieur d'un updater de setState reviendrait a
  // modifier un autre composant pendant un rendu — React le refuse, et le
  // signale par un avertissement en console.
  const traineRef = useRef(null)

  const lignes = () => [...(conteneur.current?.children ?? [])]

  const demarrer = useCallback(
    (index) => (e) => {
      // Le glissement ne doit pas faire defiler la page en meme temps.
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)

      mesures.current = lignes().map((el) => el.getBoundingClientRect())
      const depart = e.clientY
      const poser = (v) => {
        traineRef.current = v
        setTraine(v)
      }
      poser({ index, cible: index, dy: 0 })

      const bouger = (ev) => {
        const dy = ev.clientY - depart
        const r = mesures.current[index]
        if (!r) return
        const centre = r.top + r.height / 2 + dy

        // La cible est la ligne dont la bande verticale contient desormais le
        // centre de l'element traine.
        let cible = index
        for (let i = 0; i < mesures.current.length; i++) {
          const m = mesures.current[i]
          if (centre >= m.top && centre <= m.bottom) {
            cible = i
            break
          }
        }
        if (centre < mesures.current[0].top) cible = 0
        const dernier = mesures.current[mesures.current.length - 1]
        if (centre > dernier.bottom) cible = mesures.current.length - 1

        poser({ index, cible, dy })
      }

      const finir = () => {
        window.removeEventListener('pointermove', bouger)
        window.removeEventListener('pointerup', finir)
        window.removeEventListener('pointercancel', finir)

        const t = traineRef.current
        poser(null)
        if (t && t.cible !== t.index) deplacer(t.index, t.cible)
      }

      window.addEventListener('pointermove', bouger)
      window.addEventListener('pointerup', finir)
      window.addEventListener('pointercancel', finir)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )

  const deplacer = useCallback(
    (de, vers) => {
      if (de === vers || vers < 0 || vers >= items.length) return
      const copie = [...items]
      const [element] = copie.splice(de, 1)
      copie.splice(vers, 0, element)
      onReordonner(copie)
    },
    [items, onReordonner],
  )

  const auClavier = (index) => (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      deplacer(index, index + (e.key === 'ArrowUp' ? -1 : 1))
    }
  }

  /**
   * Decalage visuel d'une ligne pendant le glissement : celles situees entre
   * la position d'origine et la cible s'ecartent pour laisser la place.
   */
  function decalage(i) {
    if (!traine) return 0
    const { index, cible, dy } = traine
    if (i === index) return dy
    const h = mesures.current[index]?.height ?? 0
    if (index < cible && i > index && i <= cible) return -h
    if (index > cible && i < index && i >= cible) return h
    return 0
  }

  return (
    <ul ref={conteneur} className="flex flex-col">
      {items.map((item, i) => {
        const actif = traine?.index === i
        return (
          <li
            key={cle(item)}
            style={{
              transform: `translateY(${decalage(i)}px)`,
              // Aucune transition sur l'element traine : il doit coller au
              // doigt. Les autres glissent doucement a leur nouvelle place.
              transition: traine && !actif ? 'transform .16s ease-out' : actif ? 'none' : undefined,
              zIndex: actif ? 10 : undefined,
              position: 'relative',
              opacity: actif ? 0.92 : 1,
              boxShadow: actif ? 'var(--ombre-flottant)' : undefined,
              borderRadius: actif ? 12 : undefined,
              background: actif ? 'var(--surface)' : undefined,
              cursor: actif ? 'grabbing' : undefined,
            }}
          >
            {children(item, {
              enDeplacement: actif,
              poignee: {
                onPointerDown: demarrer(i),
                onKeyDown: auClavier(i),
                tabIndex: 0,
                role: 'button',
                'aria-label': `Déplacer ${item.nom ?? 'cet élément'} — flèches haut et bas`,
                style: { touchAction: 'none', cursor: 'grab' },
              },
            })}
          </li>
        )
      })}
    </ul>
  )
}
