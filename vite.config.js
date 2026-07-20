import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',

      // Le service worker est actif en `npm run dev` aussi : sans cela, on ne
      // pourrait tester le fonctionnement hors-ligne qu'apres un build.
      devOptions: { enabled: true, type: 'module' },

      includeAssets: ['icone.svg', 'favicon-32.png'],

      manifest: {
        name: 'Aqua Track',
        short_name: 'AquaTrack',
        description:
          "Suivez vos ventes de gallons d'eau, gérez vos revenus et optimisez votre activité en un seul endroit.",
        lang: 'fr',
        dir: 'ltr',
        start_url: '/tableau-de-bord',
        scope: '/',
        // `standalone` : l'app s'ouvre en plein écran, sans barre d'adresse.
        // C'est ce qui la rend indiscernable d'une application native.
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F3F3F3',
        theme_color: '#222026',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Les polices sont precachees explicitement : sans elles, un premier
        // lancement hors-ligne s'afficherait dans une police de secours.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],

        // Toute navigation retombe sur index.html : l'app est en SPA, et une
        // URL profonde comme /journal doit s'ouvrir hors-ligne.
        navigateFallback: '/index.html',

        runtimeCaching: [
          {
            // POINT DE VIGILANCE : les appels a Supabase ne doivent JAMAIS
            // passer par le cache. Servir une reponse d'API perimee entrerait
            // en conflit avec IndexedDB, qui est la seule source de verite —
            // l'utilisateur verrait des chiffres figes sans comprendre
            // pourquoi. Hors-ligne, l'echec reseau est le comportement
            // correct : la synchro reessaiera plus tard.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],

  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
