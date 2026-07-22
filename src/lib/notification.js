/**
 * Notifications systeme du rappel de cloture — la couche MEILLEUR EFFORT.
 *
 * Elle ne remplace jamais la banniere : elle s'y ajoute quand les conditions
 * s'y pretent. Ses limites, dites franchement :
 *
 *   - il faut la permission de l'utilisateur ;
 *   - la minuterie ne tourne que tant que l'application est OUVERTE, meme en
 *     arriere-plan. Fermee pour de bon, rien ne se declenche — un vrai rappel
 *     a heure fixe quand l'app est morte exigerait un serveur de push, que
 *     cette app locale-first n'a pas.
 *
 * Sur une tablette dediee au comptoir, l'app reste ouverte : la notification
 * du soir arrive. Ailleurs, la banniere prend le relais a la prochaine
 * ouverture.
 */

import { prochaineOccurrence, journeeCloturee } from './rappel.js'
import { cleJour } from './format.js'
import { lireMeta, ecrireMeta } from './db.js'

export function notificationsDisponibles() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function permissionAccordee() {
  return notificationsDisponibles() && Notification.permission === 'granted'
}

/** Demande la permission. Renvoie vrai si accordee. */
export async function demanderPermission() {
  if (!notificationsDisponibles()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const reponse = await Notification.requestPermission()
  return reponse === 'granted'
}

async function afficher() {
  // `showNotification` du service worker, et non `new Notification()` : sur
  // Android en mode application installee, seul le premier fonctionne.
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Aqua Track', {
    body: "Journée pas encore clôturée. Enregistrez la recette d'aujourd'hui.",
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    tag: 'rappel-cloture', // remplace au lieu d'empiler jour apres jour
    data: { url: '/tableau-de-bord' },
  })
}

/**
 * Arme le rappel et renvoie une fonction d'arret.
 *
 * `etatCourant()` est fourni par l'appelant plutot que capture : au moment ou
 * la minuterie se declenche, il faut l'etat FRAIS — reglages a jour et journee
 * du soir, pas ceux d'il y a six heures.
 */
export function demarrerRappel(etatCourant) {
  if (!notificationsDisponibles()) return () => {}

  let minuterie = null

  const declencher = async () => {
    const { reglages, journees } = etatCourant()
    const maintenant = new Date()
    if (
      reglages.rappel_actif &&
      permissionAccordee() &&
      !journeeCloturee(journees, maintenant) &&
      // Une seule notification par jour, meme si la minuterie est rearmee.
      (await lireMeta('rappel_derniere_notif', null)) !== cleJour(maintenant)
    ) {
      await afficher()
      await ecrireMeta('rappel_derniere_notif', cleJour(maintenant))
    }
    armer()
  }

  const armer = () => {
    clearTimeout(minuterie)
    const { reglages } = etatCourant()
    if (!reglages.rappel_actif) return
    const delai = prochaineOccurrence(reglages.rappel_heure) - Date.now()
    // Borne haute : setTimeout deraille au-dela de ~24,8 jours (limite 32 bits).
    // Sans objet ici — l'occurrence est a moins de 24 h — mais on se protege.
    minuterie = setTimeout(declencher, Math.min(delai, 2_147_483_647))
  }

  const auReveil = () => armer() // l'appareil sortait de veille : on recalcule
  document.addEventListener('visibilitychange', auReveil)
  armer()

  return () => {
    clearTimeout(minuterie)
    document.removeEventListener('visibilitychange', auReveil)
  }
}
