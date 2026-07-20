import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Conteneur de saisie adaptatif.
 *
 * Un seul composant, deux habillages :
 *   - mobile  : feuille montant du bas, poignee, coins arrondis en haut
 *   - desktop : modale centree de 440px
 *
 * Le contenu est rigoureusement identique — seul le contenant change. C'est
 * la regle tenue partout dans l'app : la mise en page s'adapte, jamais les
 * composants.
 */
export default function Feuille({ titre, onFermer, children, pied }) {
  const panneau = useRef(null)

  // Echap ferme, et le defilement de la page est gele pendant l'ouverture :
  // sans cela, sur mobile, le fond defile sous la feuille.
  useEffect(() => {
    const auClavier = (e) => e.key === 'Escape' && onFermer()
    document.addEventListener('keydown', auClavier)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panneau.current?.focus()
    return () => {
      document.removeEventListener('keydown', auClavier)
      document.body.style.overflow = overflow
    }
  }, [onFermer])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div
        className="absolute inset-0 animate-[apparition_.18s_ease-out]"
        style={{ background: 'rgb(34 32 38 / .45)' }}
        onClick={onFermer}
        aria-hidden="true"
      />

      <div
        ref={panneau}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={[
          'relative flex max-h-[92vh] w-full flex-col outline-none',
          'animate-[montee_.22s_cubic-bezier(.32,.72,0,1)]',
          'rounded-t-[24px] lg:max-w-[440px] lg:rounded-[24px]',
        ].join(' ')}
        style={{ background: 'var(--surface)' }}
      >
        {/* Poignee : affordance de glissement, mobile uniquement. */}
        <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden="true">
          <span
            className="h-1 w-9 rounded-full"
            style={{ background: 'var(--bordure)' }}
          />
        </div>

        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[17px] font-medium">{titre}</h2>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="-m-2 rounded-full p-2 transition-colors"
            style={{ color: 'var(--texte-doux)' }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {pied && (
          <footer
            className="px-5 pt-3 pb-5"
            style={{
              borderTop: '1px solid var(--bordure)',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}
          >
            {pied}
          </footer>
        )}
      </div>
    </div>
  )
}

/** Bouton principal des feuilles : noir, pleine largeur — comme le brief. */
export function BoutonPrincipal({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-3.5 text-sm font-medium transition-transform active:scale-[0.99] disabled:opacity-35"
      style={{ background: 'var(--action)', color: 'var(--sur-action)' }}
    >
      {children}
    </button>
  )
}
