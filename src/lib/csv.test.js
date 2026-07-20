import { describe, it, expect } from 'vitest'
import {
  versCSV,
  depuisCSV,
  lireNombreCSV,
  nombreCSV,
  typeDeCSV,
  COLONNES_RECETTES,
  COLONNES_DEPENSES,
} from './csv.js'

const COLS = [
  { titre: 'Date', valeur: (l) => l.date },
  { titre: 'Montant', valeur: (l) => nombreCSV(l.montant, 0) },
  { titre: 'Note', valeur: (l) => l.note },
]

describe('écriture CSV', () => {
  it('commence par le BOM UTF-8, sans lequel Excel casse les accents', () => {
    const csv = versCSV(COLS, [])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('sépare par point-virgule et termine par CRLF', () => {
    const csv = versCSV(COLS, [{ date: '2026-07-20', montant: 2500, note: '' }])
    expect(csv).toContain('Date;Montant;Note')
    expect(csv).toContain('\r\n')
    expect(csv).toContain('2026-07-20;2500;')
  })

  it('écrit les décimales à la française', () => {
    expect(nombreCSV(7.5)).toBe('7,50')
    expect(nombreCSV(1200, 0)).toBe('1200')
    // Aucun séparateur de milliers : il casserait la relecture par Excel.
    expect(nombreCSV(12500, 0)).not.toMatch(/[\s ]/)
  })

  it('protège les champs contenant le séparateur ou un guillemet', () => {
    const csv = versCSV(COLS, [
      { date: '2026-07-20', montant: 1, note: 'livraison; en retard' },
      { date: '2026-07-21', montant: 2, note: 'le "gros" camion' },
    ])
    expect(csv).toContain('"livraison; en retard"')
    expect(csv).toContain('"le ""gros"" camion"')
  })
})

describe('lecture CSV', () => {
  it('relit ce qu il a écrit, guillemets compris', () => {
    const source = [
      { date: '2026-07-20', montant: 2500, note: 'livraison; en retard' },
      { date: '2026-07-21', montant: 3100, note: 'le "gros" camion' },
    ]
    const { lignes } = depuisCSV(versCSV(COLS, source))
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toEqual({ Date: '2026-07-20', Montant: '2500', Note: 'livraison; en retard' })
    expect(lignes[1].Note).toBe('le "gros" camion')
  })

  it('accepte un fichier à séparateur virgule', () => {
    const { lignes } = depuisCSV('Date,Montant\r\n2026-07-20,2500\r\n')
    expect(lignes[0]).toEqual({ Date: '2026-07-20', Montant: '2500' })
  })

  it('gère un saut de ligne à l intérieur d un champ', () => {
    const { lignes } = depuisCSV('Date;Note\r\n2026-07-20;"deux\r\nlignes"\r\n')
    expect(lignes).toHaveLength(1)
    expect(lignes[0].Note).toBe('deux\nlignes')
  })

  it('ignore les lignes vides', () => {
    const { lignes } = depuisCSV('Date;Montant\r\n2026-07-20;2500\r\n\r\n;\r\n')
    expect(lignes).toHaveLength(1)
  })

  it('supporte un fichier sans BOM', () => {
    const { lignes } = depuisCSV('Date;Montant\r\n2026-07-20;2500\r\n')
    expect(lignes[0].Date).toBe('2026-07-20')
  })
})

describe('lecture des nombres', () => {
  it('accepte la virgule comme le point décimal', () => {
    expect(lireNombreCSV('7,50')).toBe(7.5)
    expect(lireNombreCSV('7.50')).toBe(7.5)
  })

  it('tolère les espaces de milliers, y compris insécables', () => {
    expect(lireNombreCSV('12 500')).toBe(12500)
    expect(lireNombreCSV('12 500')).toBe(12500)
    expect(lireNombreCSV('12 500')).toBe(12500)
  })

  it('distingue vide de zéro', () => {
    expect(lireNombreCSV('')).toBeNull()
    expect(lireNombreCSV(null)).toBeNull()
    expect(lireNombreCSV('0')).toBe(0)
    expect(lireNombreCSV('abc')).toBeNull()
  })
})

describe('reconnaissance du fichier', () => {
  it('identifie un export de recettes', () => {
    expect(typeDeCSV(COLONNES_RECETTES.map((c) => c.titre))).toBe('recettes')
  })

  it('identifie un export de dépenses', () => {
    expect(typeDeCSV(COLONNES_DEPENSES.map((c) => c.titre))).toBe('depenses')
  })

  it('refuse un fichier étranger plutôt que de deviner', () => {
    expect(typeDeCSV(['Nom', 'Prénom', 'Téléphone'])).toBeNull()
  })
})

describe('aller-retour sur les colonnes réelles', () => {
  it('conserve les valeurs d une recette', () => {
    const journee = {
      id: 'j-1',
      date: '2026-07-20',
      montant: 2500,
      moncash: 500,
      gallons: 100,
      prix_reference: 25,
      gallons_source: 'compteur',
      releve_compteur: 45220,
      note: 'journée test',
    }
    const { lignes } = depuisCSV(versCSV(COLONNES_RECETTES, [journee]))
    const l = lignes[0]

    expect(l['Date']).toBe('2026-07-20')
    expect(lireNombreCSV(l['Montant encaissé (HTG)'])).toBe(2500)
    expect(lireNombreCSV(l['Dont MonCash (HTG)'])).toBe(500)
    expect(lireNombreCSV(l['Gallons vendus'])).toBe(100)
    expect(lireNombreCSV(l['Prix de vente (HTG/gallon)'])).toBe(25)
    expect(l['Origine des gallons']).toBe('Compteur')
    expect(lireNombreCSV(l['Relevé compteur'])).toBe(45220)
    expect(l['Identifiant']).toBe('j-1')
  })

  it('conserve les valeurs d une dépense', () => {
    const depense = {
      id: 'd-1',
      date: '2026-07-20',
      categorie: "Camion d'eau",
      designation: '',
      quantity: 1200,
      unit_price: 7.5,
      total: 9000,
      payment_method: 'moncash',
      nbRecus: 2,
      note: '',
    }
    const { lignes } = depuisCSV(versCSV(COLONNES_DEPENSES, [depense]))
    const l = lignes[0]

    expect(l['Catégorie']).toBe("Camion d'eau")
    expect(lireNombreCSV(l['Quantité'])).toBe(1200)
    expect(lireNombreCSV(l['Prix unitaire (HTG)'])).toBe(7.5)
    expect(lireNombreCSV(l['Montant (HTG)'])).toBe(9000)
    expect(l['Paiement']).toBe('MonCash')
    expect(l['Identifiant']).toBe('d-1')
  })
})
