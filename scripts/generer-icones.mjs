/**
 * Rasterise public/icone.svg aux tailles exigees par le manifeste PWA.
 *
 * Lance a la main (`node scripts/generer-icones.mjs`) plutot qu'a chaque
 * build : les icones ne changent pas, et le rendu ne doit pas dependre de
 * sharp en production.
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
// fileURLToPath et non URL.pathname : le chemin du projet contient un espace,
// que pathname laisse encode en %20 et que le systeme de fichiers refuse.
import { fileURLToPath } from 'node:url'

const chemin = (relatif) => fileURLToPath(new URL(relatif, import.meta.url))
const svg = readFileSync(chemin('../public/icone.svg'))

const cibles = [
  { fichier: 'icone-192.png', taille: 192 },
  { fichier: 'icone-512.png', taille: 512 },
  // Variante « maskable » : identique ici, car le fond bleu couvre deja tout
  // le carre. Un rognage circulaire ne peut donc rien amputer d'essentiel.
  { fichier: 'icone-maskable-512.png', taille: 512 },
  { fichier: 'favicon-32.png', taille: 32 },
]

for (const { fichier, taille } of cibles) {
  await sharp(svg, { density: 400 })
    .resize(taille, taille)
    .png()
    .toFile(chemin(`../public/${fichier}`))
  console.log(`✓ public/${fichier} (${taille}×${taille})`)
}
