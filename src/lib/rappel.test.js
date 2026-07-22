import { describe, it, expect } from 'vitest'
import {
  lireHeure,
  journeeCloturee,
  heureAtteinte,
  doitAfficherBanniere,
  prochaineOccurrence,
} from './rappel.js'

const j = (date) => ({ id: `j-${date}`, date, montant: 1000, deleted: false })
// 21 juillet 2026, un mardi. Mois 6 = juillet (index 0).
const A = (h, m = 0) => new Date(2026, 6, 21, h, m, 0, 0)

describe('lireHeure', () => {
  it('lit une heure bien formee', () => {
    expect(lireHeure('20:30')).toEqual({ h: 20, m: 30 })
    expect(lireHeure('06:05')).toEqual({ h: 6, m: 5 })
  })

  it('retombe sur 20:00 pour une entree invalide', () => {
    expect(lireHeure('')).toEqual({ h: 20, m: 0 })
    expect(lireHeure('nawak')).toEqual({ h: 20, m: 0 })
    expect(lireHeure('25:00')).toEqual({ h: 20, m: 0 })
    expect(lireHeure(null)).toEqual({ h: 20, m: 0 })
  })

  it('borne les minutes sans jeter', () => {
    expect(lireHeure('20:99')).toEqual({ h: 20, m: 0 })
  })
})

describe('journeeCloturee', () => {
  it('vrai si la journee du jour existe', () => {
    expect(journeeCloturee([j('2026-07-21')], A(20))).toBe(true)
  })

  it('faux si seule une autre journee existe', () => {
    expect(journeeCloturee([j('2026-07-20')], A(20))).toBe(false)
  })

  it('ignore une journee supprimee', () => {
    expect(journeeCloturee([{ ...j('2026-07-21'), deleted: true }], A(20))).toBe(false)
  })

  it('faux sur une liste vide', () => {
    expect(journeeCloturee([], A(20))).toBe(false)
    expect(journeeCloturee(undefined, A(20))).toBe(false)
  })
})

describe('heureAtteinte', () => {
  it('faux avant l’heure', () => {
    expect(heureAtteinte('20:00', A(19, 59))).toBe(false)
  })

  it('vrai a l’heure pile', () => {
    expect(heureAtteinte('20:00', A(20, 0))).toBe(true)
  })

  it('vrai apres l’heure', () => {
    expect(heureAtteinte('20:00', A(22, 0))).toBe(true)
  })

  it('respecte les minutes', () => {
    expect(heureAtteinte('20:30', A(20, 29))).toBe(false)
    expect(heureAtteinte('20:30', A(20, 30))).toBe(true)
  })
})

describe('doitAfficherBanniere', () => {
  const base = { actif: true, heure: '20:00', journees: [], dernierRejet: null }

  it('affiche quand tout est reuni', () => {
    expect(doitAfficherBanniere({ ...base, maintenant: A(20, 1) })).toBe(true)
  })

  it('se tait si le rappel est desactive', () => {
    expect(doitAfficherBanniere({ ...base, actif: false, maintenant: A(21) })).toBe(false)
  })

  it('se tait avant l’heure', () => {
    expect(doitAfficherBanniere({ ...base, maintenant: A(18) })).toBe(false)
  })

  it('se tait si la journee est deja close', () => {
    expect(
      doitAfficherBanniere({ ...base, journees: [j('2026-07-21')], maintenant: A(21) }),
    ).toBe(false)
  })

  it('se tait si l’utilisateur l’a ecarte aujourd’hui', () => {
    expect(
      doitAfficherBanniere({ ...base, dernierRejet: '2026-07-21', maintenant: A(21) }),
    ).toBe(false)
  })

  it('reparait le lendemain apres un rejet de la veille', () => {
    expect(
      doitAfficherBanniere({ ...base, dernierRejet: '2026-07-20', maintenant: A(21) }),
    ).toBe(true)
  })
})

describe('prochaineOccurrence', () => {
  it('vise aujourd’hui si l’heure n’est pas passee', () => {
    const p = prochaineOccurrence('20:00', A(18))
    expect(p.getDate()).toBe(21)
    expect(p.getHours()).toBe(20)
    expect(p.getMinutes()).toBe(0)
  })

  it('vise demain si l’heure est passee', () => {
    const p = prochaineOccurrence('20:00', A(21))
    expect(p.getDate()).toBe(22)
    expect(p.getHours()).toBe(20)
  })

  it('a l’heure pile, vise deja le lendemain', () => {
    // « <= depuis » : declencher a l'instant present serait un rappel en
    // retard d'une fraction de seconde, on saute a la prochaine vraie occasion.
    const p = prochaineOccurrence('20:00', A(20, 0))
    expect(p.getDate()).toBe(22)
  })
})
