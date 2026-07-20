/**
 * Client Supabase — optionnel.
 *
 * Sans variables d'environnement, ce module exporte `null` et toute la
 * synchronisation devient un no-op silencieux. L'application reste alors
 * PLEINEMENT fonctionnelle : IndexedDB est la source de verite, Supabase
 * n'est qu'une sauvegarde distante.
 *
 * C'est deliberé. Brancher la synchro plus tard ne demande que de remplir
 * un fichier .env — aucun code a modifier.
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const cle = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const supabaseConfigure = Boolean(url && cle)

export const supabase = supabaseConfigure
  ? createClient(url, cle, {
      auth: { persistSession: true, autoRefreshToken: true },
      // Le realtime est inutile ici : un seul operateur, et la reconnexion
      // permanente d'un websocket sur un reseau instable coute plus qu'elle
      // ne rapporte.
      realtime: { params: { eventsPerSecond: 1 } },
    })
  : null
